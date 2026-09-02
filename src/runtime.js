/**
 * Privacy primitives for browser-side WebMCP tools.
 *
 * The runtime keeps private values behind encrypted, context-bound handles.
 * Tool implementations must explicitly return either a public result or a new
 * private handle, which makes disclosure a deliberate application decision.
 */
import { resolveModelContext } from "./model-context.js";

export const WEBMCP_PRIVATE_HANDLE_SCHEMA = "mirror.webmcp.private_handle.v1";
export const WEBMCP_PRIVATE_BINDING_SCHEMA = "mirror.webmcp.private_binding.v1";
export const WEBMCP_PRIVATE_EVIDENCE_SCHEMA = "mirror.webmcp.privacy_evidence.v1";
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const PRIVATE_RESULT = Symbol("mirror.webmcp.private-result");
export class MirrorWebMcpPrivacyError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "MirrorWebMcpPrivacyError";
        this.code = code;
    }
}
/**
 * Browser-local privacy runtime for WebMCP.
 *
 * The AES key is generated as a non-extractable WebCrypto key. Private values
 * are retained only as authenticated ciphertext, and the authenticated binding
 * is checked against the live origin/user/session/model context every time a
 * tool opens a handle.
 */
export class MirrorWebMcpPrivacy {
    contextProvider;
    modelContext;
    defaultTtlMs;
    maxHandles;
    maxEvidenceEvents;
    approval;
    onEvidence;
    now;
    crypto;
    key;
    records = new Map();
    registrations = new Map();
    toolPacks = new Map();
    evidenceRecords = [];
    evidenceSequence = 0;
    constructor(options) {
        this.contextProvider = typeof options.context === "function"
            ? options.context
            : () => options.context;
        const document = options.document ?? globalDocument();
        const navigator = options.navigator ?? globalNavigator();
        this.modelContext = resolveModelContext(options.modelContext, document?.modelContext, navigator?.modelContext);
        this.defaultTtlMs = positiveInteger(options.defaultTtlMs ?? 15 * 60_000, "defaultTtlMs");
        this.maxHandles = positiveInteger(options.maxHandles ?? 500, "maxHandles");
        this.maxEvidenceEvents = positiveInteger(options.maxEvidenceEvents ?? 1_000, "maxEvidenceEvents");
        this.approval = options.approval;
        this.onEvidence = options.onEvidence;
        this.now = options.now ?? Date.now;
        this.crypto = options.crypto ?? globalCrypto();
        this.key = this.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        normalizeContext(this.contextProvider());
    }
    isAvailable() {
        return Boolean(this.modelContext?.registerTool);
    }
    registeredTools() {
        return [...this.registrations.keys()].sort();
    }
    registeredToolPacks() {
        return [...this.toolPacks.entries()]
            .map(([name, tools]) => ({ name, tools: [...tools] }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }
    evidence() {
        return this.evidenceRecords.map((event) => ({
            ...event,
            details: event.details ? { ...event.details } : undefined,
        }));
    }
    listHandles() {
        this.evictExpired();
        return [...this.records.values()].map((record) => cloneDescriptor(record.descriptor));
    }
    describe(handle) {
        const record = this.requireRecord(handle);
        return cloneDescriptor(record.descriptor);
    }
    async protect(value, options) {
        this.evictExpired();
        if (this.records.size >= this.maxHandles) {
            throw new MirrorWebMcpPrivacyError("handle_limit", "The private handle limit has been reached.");
        }
        const context = normalizeContext(this.contextProvider());
        const kind = requireText("kind", options.kind);
        const purpose = requireText("purpose", options.purpose);
        const allowedTools = normalizeToolNames(options.allowedTools);
        const ttlMs = positiveInteger(options.ttlMs ?? this.defaultTtlMs, "ttlMs");
        const createdAtMs = this.now();
        const expiresAtMs = createdAtMs + ttlMs;
        const createdAt = new Date(createdAtMs).toISOString();
        const expiresAt = new Date(expiresAtMs).toISOString();
        const binding = {
            schema: WEBMCP_PRIVATE_BINDING_SCHEMA,
            origin: context.origin,
            session_id: context.sessionId,
            user_id: context.userId,
            model: context.model,
            kind,
            purpose,
            allowed_tools: allowedTools,
            created_at: createdAt,
            expires_at: expiresAt,
        };
        const bindingBytes = encodeText(canonicalJson(binding));
        const bindingDigest = await digest(this.crypto, bindingBytes);
        const handle = `mirrorh_v1_${randomHex(this.crypto, 18)}`;
        const nonce = randomBytes(this.crypto, 12);
        const encoded = encodePrivateValue(value);
        const ciphertext = new Uint8Array(await this.crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: bindingBytes }, await this.key, encoded.bytes));
        const descriptor = {
            schema: WEBMCP_PRIVATE_HANDLE_SCHEMA,
            handle,
            kind,
            purpose,
            allowedTools,
            createdAt,
            expiresAt,
            bindingDigest,
        };
        this.records.set(handle, {
            descriptor,
            binding,
            nonce,
            ciphertext,
            encoding: encoded.encoding,
            expiresAtMs,
        });
        await this.emit("handle.protected", "success", {
            handle,
            details: { kind, purpose, allowedToolCount: allowedTools.length, ttlMs },
        });
        return cloneDescriptor(descriptor);
    }
    async resolve(handle, options) {
        validateToolName(options.toolName);
        const record = this.requireRecord(handle);
        const current = normalizeContext(this.contextProvider());
        const binding = record.binding;
        const contextMatches = binding.origin === current.origin
            && binding.session_id === current.sessionId
            && binding.user_id === current.userId
            && binding.model === current.model;
        const toolAllowed = binding.allowed_tools.includes(options.toolName);
        const kindMatches = options.kind === undefined || record.descriptor.kind === options.kind;
        const purposeMatches = options.purpose === undefined || record.descriptor.purpose === options.purpose;
        if (!contextMatches || !toolAllowed || !kindMatches || !purposeMatches) {
            await this.emit("tool.denied", "deny", {
                toolName: options.toolName,
                handle,
                details: {
                    reason: !contextMatches
                        ? "context_mismatch"
                        : !toolAllowed
                            ? "tool_not_allowed"
                            : !kindMatches
                                ? "kind_mismatch"
                                : "purpose_mismatch",
                },
            });
            throw new MirrorWebMcpPrivacyError(!contextMatches ? "context_mismatch" : !toolAllowed ? "tool_not_allowed" : "binding_mismatch", "The private handle is not valid for this tool context.");
        }
        const bindingBytes = encodeText(canonicalJson(binding));
        try {
            const plaintext = new Uint8Array(await this.crypto.subtle.decrypt({ name: "AES-GCM", iv: record.nonce, additionalData: bindingBytes }, await this.key, record.ciphertext));
            const value = decodePrivateValue(plaintext, record.encoding);
            await this.emit("handle.opened", "success", {
                toolName: options.toolName,
                handle,
                details: { kind: record.descriptor.kind, purpose: record.descriptor.purpose },
            });
            return value;
        }
        catch (error) {
            if (error instanceof MirrorWebMcpPrivacyError)
                throw error;
            throw new MirrorWebMcpPrivacyError("authentication_failed", "The private handle could not be authenticated.");
        }
    }
    async revoke(handle) {
        const existed = this.records.delete(handle);
        if (existed)
            await this.emit("handle.revoked", "success", { handle });
        return existed;
    }
    async registerTool(tool) {
        if (!this.modelContext?.registerTool) {
            throw new MirrorWebMcpPrivacyError("webmcp_unavailable", "WebMCP is not available in this browser. Pass a modelContext when testing outside a supported browser.");
        }
        validateToolName(tool.name);
        requireText("description", tool.description);
        if (this.registrations.has(tool.name)) {
            throw new MirrorWebMcpPrivacyError("tool_exists", `A WebMCP tool named '${tool.name}' is already registered.`);
        }
        const controller = new AbortController();
        const nativeTool = {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: normalizeInputSchema(tool.inputSchema),
            annotations: tool.annotations,
            execute: async (rawArgs, nativeOptions) => {
                const args = requireArgs(rawArgs);
                const state = {
                    canaries: [],
                    argumentNames: Object.keys(args).sort(),
                };
                await this.emit("tool.invoked", "allow", {
                    toolName: tool.name,
                    details: { argumentNames: state.argumentNames, requiresApproval: Boolean(tool.requiresApproval) },
                });
                try {
                    if (tool.requiresApproval) {
                        await this.requireApproval({
                            phase: "action",
                            toolName: tool.name,
                            summary: tool.approvalSummary ?? `Allow ${tool.name} to run`,
                            argumentNames: state.argumentNames,
                        });
                    }
                    const invocation = {
                        toolName: tool.name,
                        signal: nativeOptions?.signal,
                        resolve: async (handle, expected = {}) => {
                            const value = await this.resolve(handle, { toolName: tool.name, ...expected });
                            addCanary(state.canaries, value);
                            return value;
                        },
                        describe: (handle) => this.describe(handle),
                        publicResult: (value, options = {}) => ({
                            [PRIVATE_RESULT]: true,
                            mode: "public",
                            value,
                            options,
                        }),
                        privateResult: (value, options) => ({
                            [PRIVATE_RESULT]: true,
                            mode: "private",
                            value,
                            options,
                        }),
                    };
                    const result = await tool.execute(args, invocation);
                    if (!isToolResult(result)) {
                        throw new MirrorWebMcpPrivacyError("implicit_release", "Private WebMCP tools must return context.publicResult() or context.privateResult().");
                    }
                    const response = result.mode === "public"
                        ? await this.releasePublicResult(tool.name, result, state)
                        : await this.releasePrivateResult(tool.name, result, state);
                    await this.emit("tool.completed", "success", {
                        toolName: tool.name,
                        details: { resultMode: result.mode },
                    });
                    return response;
                }
                catch (error) {
                    await this.emit("tool.denied", "deny", {
                        toolName: tool.name,
                        details: {
                            reason: error instanceof MirrorWebMcpPrivacyError ? error.code : "tool_failed",
                        },
                    });
                    throw error;
                }
            },
        };
        try {
            await this.modelContext.registerTool(nativeTool, {
                signal: controller.signal,
                exposedTo: normalizeExposedOrigins(tool.exposedTo),
            });
            this.registrations.set(tool.name, controller);
            await this.emit("tool.registered", "success", {
                toolName: tool.name,
                details: { readOnly: Boolean(tool.annotations?.readOnlyHint) },
            });
        }
        catch (error) {
            controller.abort();
            throw error;
        }
    }
    /**
     * Registers a complete use-case pack atomically. If any tool fails to
     * register, tools added earlier in the same pack are unregistered.
     */
    async registerToolPack(pack) {
        validateToolName(pack.name);
        if (!Array.isArray(pack.tools) || pack.tools.length === 0) {
            throw new MirrorWebMcpPrivacyError("invalid_tool_pack", "A WebMCP tool pack must contain at least one tool.");
        }
        if (this.toolPacks.has(pack.name)) {
            throw new MirrorWebMcpPrivacyError("tool_pack_exists", `A WebMCP tool pack named '${pack.name}' is registered.`);
        }
        const names = pack.tools.map((tool) => {
            validateToolName(tool.name);
            return tool.name;
        });
        if (new Set(names).size !== names.length) {
            throw new MirrorWebMcpPrivacyError("duplicate_tool", "A WebMCP tool pack cannot contain duplicate tool names.");
        }
        const collision = names.find((name) => this.registrations.has(name));
        if (collision) {
            throw new MirrorWebMcpPrivacyError("tool_exists", `A WebMCP tool named '${collision}' is already registered.`);
        }
        const registered = [];
        try {
            for (const tool of pack.tools) {
                await this.registerTool(tool);
                registered.push(tool.name);
            }
            this.toolPacks.set(pack.name, [...names]);
        }
        catch (error) {
            for (const name of registered.reverse())
                await this.unregisterTool(name);
            throw error;
        }
    }
    async unregisterTool(name) {
        const controller = this.registrations.get(name);
        if (!controller)
            return false;
        controller.abort();
        this.registrations.delete(name);
        for (const [packName, tools] of this.toolPacks) {
            if (!tools.includes(name))
                continue;
            const remaining = tools.filter((toolName) => toolName !== name);
            if (remaining.length === 0)
                this.toolPacks.delete(packName);
            else
                this.toolPacks.set(packName, remaining);
        }
        await this.emit("tool.unregistered", "success", { toolName: name });
        return true;
    }
    async unregisterToolPack(name) {
        const tools = this.toolPacks.get(name);
        if (!tools)
            return false;
        this.toolPacks.delete(name);
        for (const toolName of [...tools].reverse())
            await this.unregisterTool(toolName);
        return true;
    }
    async dispose() {
        const tools = [...this.registrations.keys()];
        for (const name of tools)
            await this.unregisterTool(name);
        const handles = [...this.records.keys()];
        for (const handle of handles)
            await this.revoke(handle);
    }
    async releasePublicResult(toolName, result, state) {
        const sensitivity = result.options.sensitivity ?? "public";
        if (result.options.allowPrivateData && sensitivity !== "sensitive") {
            throw new MirrorWebMcpPrivacyError("invalid_release_policy", "Private data release must be marked sensitive.");
        }
        if (!result.options.allowPrivateData && containsCanary(result.value, state.canaries)) {
            throw new MirrorWebMcpPrivacyError("private_data_release_blocked", "A tool result attempted to release data opened from a private handle.");
        }
        if (sensitivity === "sensitive") {
            await this.requireApproval({
                phase: "release",
                toolName,
                summary: result.options.approvalSummary ?? `Release the sensitive result from ${toolName}`,
                argumentNames: state.argumentNames,
                sensitivity,
            });
        }
        return result.value;
    }
    async releasePrivateResult(toolName, result, state) {
        if (result.options.publicValue !== undefined && containsCanary(result.options.publicValue, state.canaries)) {
            throw new MirrorWebMcpPrivacyError("private_data_release_blocked", "A private tool's public preview attempted to release private data.");
        }
        const descriptor = await this.protect(result.value, result.options);
        return {
            ok: true,
            privacy: {
                mode: "private_handle",
                ...descriptor,
            },
            ...(result.options.publicValue === undefined ? {} : { public: result.options.publicValue }),
            producedBy: toolName,
        };
    }
    async requireApproval(request) {
        if (!this.approval || !(await this.approval(request))) {
            throw new MirrorWebMcpPrivacyError("approval_required", "The user did not approve this operation.");
        }
    }
    requireRecord(handle) {
        if (typeof handle !== "string" || !handle.startsWith("mirrorh_v1_")) {
            throw new MirrorWebMcpPrivacyError("invalid_handle", "The private handle is invalid or unavailable.");
        }
        const record = this.records.get(handle);
        if (!record) {
            throw new MirrorWebMcpPrivacyError("invalid_handle", "The private handle is invalid or unavailable.");
        }
        if (record.expiresAtMs <= this.now()) {
            this.records.delete(handle);
            throw new MirrorWebMcpPrivacyError("handle_expired", "The private handle has expired.");
        }
        return record;
    }
    evictExpired() {
        const now = this.now();
        for (const [handle, record] of this.records) {
            if (record.expiresAtMs <= now)
                this.records.delete(handle);
        }
    }
    async emit(event, outcome, fields = {}) {
        const record = {
            schema: WEBMCP_PRIVATE_EVIDENCE_SCHEMA,
            sequence: ++this.evidenceSequence,
            timestamp: new Date(this.now()).toISOString(),
            event,
            outcome,
            toolName: fields.toolName,
            handleDigest: fields.handle ? await digest(this.crypto, encodeText(fields.handle)) : undefined,
            details: fields.details,
        };
        this.evidenceRecords.push(record);
        if (this.evidenceRecords.length > this.maxEvidenceEvents)
            this.evidenceRecords.shift();
        await this.onEvidence?.(record);
    }
}
function globalDocument() {
    return globalThis.document;
}
function globalNavigator() {
    return globalThis.navigator;
}
function globalCrypto() {
    const crypto = globalThis.crypto;
    if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") {
        throw new MirrorWebMcpPrivacyError("webcrypto_unavailable", "The WebMCP privacy layer requires WebCrypto.");
    }
    return crypto;
}
function normalizeContext(context) {
    return {
        origin: requireText("context.origin", context.origin),
        sessionId: requireText("context.sessionId", context.sessionId),
        userId: optionalText(context.userId),
        model: optionalText(context.model),
    };
}
function normalizeToolNames(names) {
    if (!Array.isArray(names) || names.length === 0) {
        throw new MirrorWebMcpPrivacyError("invalid_binding", "allowedTools must contain at least one tool name.");
    }
    return [...new Set(names.map((name) => {
            validateToolName(name);
            return name;
        }))].sort();
}
function normalizeInputSchema(schema = {}) {
    if (schema.type !== undefined && schema.type !== "object") {
        throw new MirrorWebMcpPrivacyError("invalid_schema", "WebMCP tool input schemas must describe an object.");
    }
    return {
        ...schema,
        type: "object",
        properties: schema.properties ?? {},
        additionalProperties: schema.additionalProperties ?? false,
    };
}
function normalizeExposedOrigins(origins) {
    if (origins === undefined)
        return undefined;
    const normalized = [...new Set(origins.map((origin) => {
            let url;
            try {
                url = new URL(origin);
            }
            catch {
                throw new MirrorWebMcpPrivacyError("invalid_origin", "WebMCP exposedTo entries must be valid origins.");
            }
            if (url.origin !== origin || (url.protocol !== "https:" && url.hostname !== "localhost")) {
                throw new MirrorWebMcpPrivacyError("invalid_origin", "WebMCP exposedTo entries must be secure origins without paths.");
            }
            return url.origin;
        }))];
    return normalized.length ? normalized.sort() : undefined;
}
function validateToolName(name) {
    if (!TOOL_NAME_PATTERN.test(String(name ?? ""))) {
        throw new MirrorWebMcpPrivacyError("invalid_tool_name", "WebMCP tool names must contain 1-128 ASCII letters, digits, underscore, hyphen, or period characters.");
    }
}
function requireArgs(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new MirrorWebMcpPrivacyError("invalid_arguments", "WebMCP tool arguments must be an object.");
    }
    return value;
}
function requireText(field, value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new MirrorWebMcpPrivacyError("invalid_value", `${field} is required.`);
    }
    return value.trim();
}
function optionalText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function positiveInteger(value, field) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new MirrorWebMcpPrivacyError("invalid_value", `${field} must be a positive integer.`);
    }
    return value;
}
function randomBytes(crypto, length) {
    return crypto.getRandomValues(new Uint8Array(length));
}
function randomHex(crypto, length) {
    return [...randomBytes(crypto, length)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function encodeText(value) {
    return new TextEncoder().encode(value);
}
function encodePrivateValue(value) {
    if (value instanceof Uint8Array)
        return { bytes: new Uint8Array(value), encoding: "bytes" };
    let encoded;
    try {
        encoded = JSON.stringify(value);
    }
    catch {
        encoded = undefined;
    }
    if (encoded === undefined) {
        throw new MirrorWebMcpPrivacyError("not_serializable", "Private handle values must be JSON or Uint8Array data.");
    }
    return { bytes: encodeText(encoded), encoding: "json" };
}
function decodePrivateValue(bytes, encoding) {
    if (encoding === "bytes")
        return new Uint8Array(bytes);
    return JSON.parse(new TextDecoder().decode(bytes));
}
function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]));
    }
    return value;
}
async function digest(crypto, bytes) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function cloneDescriptor(descriptor) {
    return { ...descriptor, allowedTools: [...descriptor.allowedTools] };
}
function isToolResult(value) {
    return Boolean(value)
        && typeof value === "object"
        && value[PRIVATE_RESULT] === true;
}
function addCanary(canaries, value) {
    if (typeof value === "string") {
        if (value.length >= 4)
            canaries.push(value);
        return;
    }
    if (value instanceof Uint8Array)
        return;
    try {
        const encoded = JSON.stringify(value);
        if (encoded && encoded.length >= 8)
            canaries.push(encoded);
    }
    catch {
        // The value was decoded from JSON, so this is defensive only.
    }
}
function containsCanary(value, canaries) {
    if (canaries.length === 0)
        return false;
    let encoded;
    try {
        encoded = typeof value === "string" ? value : JSON.stringify(value);
    }
    catch {
        return true;
    }
    return canaries.some((canary) => encoded.includes(canary));
}
