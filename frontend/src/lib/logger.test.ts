import { describe, expect, it, vi } from "vitest";
import { createLogger, redact, redactString, type LogEntry } from "./logger";

function makeSink() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("redact", () => {
  it("masks sensitive keys at any depth", () => {
    const out = redact({
      token: "abc",
      user: { password: "hunter2", email: "a@b.com", phone: "+254700000000", mobile_number: "0700" },
      card: { cvv: "123", number: "4111" },
      pin: "1234",
      otp: "999999",
      secret: "s",
      authorization: "Bearer xyz",
      name: "Ada",
    }) as Record<string, unknown>;
    const user = out.user as Record<string, unknown>;

    expect(out.token).toBe("[REDACTED]");
    expect(user.password).toBe("[REDACTED]");
    expect(user.email).toBe("[REDACTED]");
    expect(user.phone).toBe("[REDACTED]");
    expect(user.mobile_number).toBe("[REDACTED]");
    expect(out.card).toBe("[REDACTED]");
    expect(out.pin).toBe("[REDACTED]");
    expect(out.otp).toBe("[REDACTED]");
    expect(out.secret).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.name).toBe("Ada");
  });

  it("masks keys that end in a sensitive word, regardless of case or separators", () => {
    const out = redact({ accessToken: "a", refresh_token: "b", client_secret: "c", newPassword: "d", shipping: "ok" }) as Record<string, string>;
    expect(out.accessToken).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect(out.client_secret).toBe("[REDACTED]");
    expect(out.newPassword).toBe("[REDACTED]");
    expect(out.shipping).toBe("ok");
  });

  it("masks Bearer tokens inside strings", () => {
    expect(redactString("Request failed with Authorization: Bearer eyJhbGciOi.payload-part_1")).toBe(
      "Request failed with Authorization: Bearer [REDACTED]",
    );
    expect(redact({ header: "bearer abc123" })).toEqual({ header: "Bearer [REDACTED]" });
  });

  it("masks secret query parameters and email addresses in free text", () => {
    expect(redactString("GET /x?token=abc123&page=2")).toBe("GET /x?token=[REDACTED]&page=2");
    expect(redactString("user jane.doe@example.com failed")).toBe("user [REDACTED] failed");
  });

  it("drops Axios-style config and headers, keeping status, method and path", () => {
    const axiosLike = Object.assign(new Error("Request failed with status code 401"), {
      code: "ERR_BAD_REQUEST",
      config: {
        method: "get",
        url: "/users/me?token=secret-value",
        headers: { Authorization: "Bearer very-secret" },
      },
      response: { status: 401, data: { message: "Unauthenticated" } },
    });

    const out = JSON.stringify(redact(axiosLike));
    expect(out).not.toContain("very-secret");
    expect(out).not.toContain("secret-value");
    expect(out).not.toContain("Authorization");
    expect(out).toContain('"status":401');
    expect(out).toContain('"method":"GET"');
    expect(out).toContain('"url":"/users/me"');
  });

  it("bounds long strings, deep nesting, wide objects and long arrays", () => {
    const longString = "x".repeat(2000);
    expect((redact(longString) as string).length).toBeLessThanOrEqual(520);

    const deep = { a: { b: { c: { d: { e: "too deep" } } } } };
    expect(JSON.stringify(redact(deep))).toContain("[Truncated]");

    const wide: Record<string, number> = {};
    for (let i = 0; i < 100; i++) wide[`k${i}`] = i;
    expect(Object.keys(redact(wide) as object).length).toBeLessThanOrEqual(31);

    const list = Array.from({ length: 100 }, (_, i) => i);
    expect((redact(list) as unknown[]).length).toBe(21);
  });

  it("does not throw on circular structures", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
  });

  it("replaces class instances with their constructor name", () => {
    class Session {
      token = "abc";
    }
    expect(redact(new Session())).toBe("[Session]");
  });
});

describe("createLogger", () => {
  it("writes to the console in development, passing the message and context through", () => {
    const sink = makeSink();
    const log = createLogger({ dev: true, sink });
    const context = { status: 500 };

    log.error("Failed to load", context);
    log.warn("Careful");
    log.info("Info");
    log.debug("Debug");

    expect(sink.error).toHaveBeenCalledWith("Failed to load", context);
    expect(sink.warn).toHaveBeenCalledWith("Careful");
    expect(sink.info).toHaveBeenCalledWith("Info");
    expect(sink.debug).toHaveBeenCalledWith("Debug");
  });

  it("writes nothing to the console in production", () => {
    const sink = makeSink();
    const log = createLogger({ dev: false, sink });

    log.error("Failed", { token: "abc" });
    log.warn("Warn");
    log.info("Info");
    log.debug("Debug");

    expect(sink.error).not.toHaveBeenCalled();
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.debug).not.toHaveBeenCalled();
  });

  it("sends only redacted and bounded entries to the transport in production", () => {
    const sink = makeSink();
    const sent: LogEntry[] = [];
    const log = createLogger({ dev: false, sink, send: (entry) => sent.push(entry) });

    log.error(`Bearer abc.def leaked for ${"m".repeat(1000)}`, {
      password: "hunter2",
      email: "jane@example.com",
      nested: { authorization: "Bearer zzz" },
    });

    expect(sent).toHaveLength(1);
    const entry = sent[0]!;
    expect(entry.level).toBe("error");
    expect(entry.message.length).toBeLessThanOrEqual(320);
    expect(entry.message).not.toContain("abc.def");
    expect(JSON.stringify(entry.context)).not.toContain("hunter2");
    expect(JSON.stringify(entry.context)).not.toContain("jane@example.com");
    expect(JSON.stringify(entry.context)).not.toContain("zzz");
    expect(typeof entry.time).toBe("string");
    expect(sink.error).not.toHaveBeenCalled();
  });

  it("never throws if the transport fails", () => {
    const log = createLogger({
      dev: false,
      send: () => {
        throw new Error("network down");
      },
    });
    expect(() => log.error("boom")).not.toThrow();
  });
});
