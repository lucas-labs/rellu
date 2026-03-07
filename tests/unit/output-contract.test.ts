import { expect, mock, test } from "bun:test";

test("writeActionOutputs keeps stable top-level output keys", async () => {
  const setOutputMock = mock((_name: string, _value: string) => {});
  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: () => "",
        setOutput: setOutputMock,
        info: () => {},
        warn: () => {},
        error: () => {},
        setFailed: () => {}
      }
    }));

    const { writeActionOutputs } = await import("../../src/output.ts");
    writeActionOutputs({
      changedTargets: ["app-1"],
      hasChanges: true,
      resultJson: '{"label":"app-1"}',
      releasePrsCreated: false
    });

    const keys = setOutputMock.mock.calls.map((call) => String(call[0]));
    expect(keys).toEqual(["changed-targets", "has-changes", "result-json", "release-prs-created"]);
  } finally {
    mock.restore();
  }
});

test("writeActionOutputs preserves result-json envelope contract and skipped target releasePr metadata", async () => {
  const setOutputMock = mock((_name: string, _value: string) => {});
  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: () => "",
        setOutput: setOutputMock,
        info: () => {},
        warn: () => {},
        error: () => {},
        setFailed: () => {}
      }
    }));

    const queryKey = "output-contract-release-pr";
    const { writeActionOutputs } = await import(`../../src/output.ts?${queryKey}`);
    const resultPayload = {
      range: "from-sha..to-sha",
      commitCount: 3,
      results: [
        {
          label: "app-1",
          changed: true,
          releasePr: {
            enabled: false
          }
        }
      ]
    };
    writeActionOutputs({
      changedTargets: ["app-1"],
      hasChanges: true,
      resultJson: JSON.stringify(resultPayload),
      releasePrsCreated: false
    });

    const resultJsonCall = setOutputMock.mock.calls.find((call) => String(call[0]) === "result-json");
    expect(resultJsonCall).toBeDefined();
    const parsed = JSON.parse(String(resultJsonCall?.[1] ?? "{}"));
    expect(parsed.range).toBe("from-sha..to-sha");
    expect(parsed.commitCount).toBe(3);
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results[0]?.releasePr?.enabled).toBe(false);
    expect(parsed.results[0]?.releasePr?.branch).toBeUndefined();
    expect(parsed.results[0]?.releasePr?.number).toBeUndefined();
  } finally {
    mock.restore();
  }
});

test("writeActionOutputs keeps deterministic result-json envelope values for identical payloads", async () => {
  const setOutputMock = mock((_name: string, _value: string) => {});
  try {
    mock.module("../../src/toolkit/core-client.ts", () => ({
      coreClient: {
        getInput: () => "",
        setOutput: setOutputMock,
        info: () => {},
        warn: () => {},
        error: () => {},
        setFailed: () => {}
      }
    }));

    const queryKey = "output-contract-deterministic-envelope";
    const { writeActionOutputs } = await import(`../../src/output.ts?${queryKey}`);
    const envelope = {
      range: "from-sha..to-sha",
      commitCount: 2,
      results: [{ label: "app-1", changed: true }]
    };

    writeActionOutputs({
      changedTargets: ["app-1"],
      hasChanges: true,
      resultJson: JSON.stringify(envelope, null, 2),
      releasePrsCreated: false
    });
    writeActionOutputs({
      changedTargets: ["app-1"],
      hasChanges: true,
      resultJson: JSON.stringify(envelope, null, 2),
      releasePrsCreated: false
    });

    const resultJsonCalls = setOutputMock.mock.calls.filter((call) => String(call[0]) === "result-json");
    expect(resultJsonCalls).toHaveLength(2);
    expect(String(resultJsonCalls[0]?.[1])).toBe(String(resultJsonCalls[1]?.[1]));
  } finally {
    mock.restore();
  }
});
