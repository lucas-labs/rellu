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
