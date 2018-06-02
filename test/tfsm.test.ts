import { StateMachine } from "../src/tfsm";

/**
 * Dummy test
 */
describe("Dummy test", () => {
	it("works if true is truthy", () => {
		expect(true).toBeTruthy();
	});

	it("DummyClass is instantiable", () => {
		expect(new StateMachine("", { states: [] }, { transitions: [] })).toBeInstanceOf(
			StateMachine
		);
	});
});
