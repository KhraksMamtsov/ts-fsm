import "reflect-metadata";

import {
	State,
	STATE_MACHINE_STATE_META_KEY,
	Transitable,
	STATE_MACHINE_TRANSITION_META_KEY,
	TFSM,
	StateMachineClassAdapter,
} from "../src/AOP";
import { StateMachineError } from "../src/Error";

enum STATES {
	SOLID = "SOLID",
	LIQUID = "LIQUID",
	GAS = "GAS",
	PLASMA = "PLASMA",
}

enum TRANSITIONS {
	MELT = "MELT",
	VAPORIZE = "VAPORIZE",
	CONDENSE = "CONDENSE",
	FREEZE = "FREEZE",
}

// tslint:disable-next-line:no-empty
const noop = () => {};

type temperature = number;
const qwe = Symbol("qwe");

@TFSM(STATES.LIQUID)
class TestStateMachine extends StateMachineClassAdapter<STATES, TRANSITIONS, temperature> {
	public deg = "-20 deg";

	@State<STATES, TRANSITIONS, temperature>(STATES.SOLID, {
		before: noop,
	})
	public [STATES.SOLID]: Partial<TestStateMachine> = {
		deg: "-25 C",
	};

	@Transitable<STATES, TRANSITIONS, temperature>(
		TRANSITIONS.VAPORIZE,
		STATES.LIQUID,
		STATES.GAS,
		{ before: [noop] }
	)
	@Transitable<STATES, TRANSITIONS, temperature>(
		TRANSITIONS.FREEZE,
		STATES.LIQUID,
		STATES.SOLID,
		{ before: [noop] }
	)
	@State<STATES, TRANSITIONS, temperature>(STATES.LIQUID)
	public [STATES.LIQUID]: Partial<TestStateMachine> = {
		deg: "+5 C",
	};

	// @Transitable(
	// 	TRANSITIONS.CONDENSE,
	// 	STATES.GAS,
	// 	STATES.LIQUID)
	@Transitable<STATES, TRANSITIONS, temperature>(
		TRANSITIONS.CONDENSE,
		STATES.GAS,
		STATES.LIQUID,
		{ before: [noop, noop] }
	)
	@State(STATES.GAS)
	@State(STATES.PLASMA)
	public [STATES.GAS]: Partial<TestStateMachine> = {
		deg: "+105 C",
	};

	public asd = "asd";
	public [qwe] = "Symbol = qwe";

	// @StateMachine.Transitable(STATES.GAS, [STATES.LIQUID, STATES.PLASMA])
	// public [STATES.GAS] = {
	// 	deg: "+105 C"
	// };
}

describe("State Machine Metadata", () => {
	let TestSM: TestStateMachine;

	beforeEach(() => {
		TestSM = new TestStateMachine();
		Reflect.deleteMetadata(STATE_MACHINE_STATE_META_KEY, TestSM, STATES.LIQUID);
		Reflect.deleteMetadata(STATE_MACHINE_STATE_META_KEY, TestSM, STATES.GAS);
		Reflect.deleteMetadata(STATE_MACHINE_TRANSITION_META_KEY, TestSM, STATES.GAS);
		Reflect.deleteMetadata(STATE_MACHINE_TRANSITION_META_KEY, TestSM, STATES.GAS);
	});

	it("enshure client class instance", () => {
		expect(TestSM).toBeInstanceOf(TestStateMachine);
		expect(TestSM).toBeInstanceOf(StateMachineClassAdapter);
	});

	it("reflect state metadata", () => {
		expect(Reflect.getMetadata(STATE_MACHINE_STATE_META_KEY, TestSM, STATES.LIQUID)).toEqual([
			{
				name: STATES.LIQUID,
				data: {
					deg: "+5 C",
				},
				before: [],
				after: [],
			},
		]);
	});

	it("reflect several state metadata", () => {
		expect(Reflect.getMetadata(STATE_MACHINE_STATE_META_KEY, TestSM, STATES.GAS)).toEqual([
			{
				name: STATES.GAS,
				data: {
					deg: "+105 C",
				},
				before: [],
				after: [],
			},
			{
				name: STATES.PLASMA,
				data: {
					deg: "+105 C",
				},
				before: [],
				after: [],
			},
		]);
	});

	it("reflect transition metadata", () => {
		expect(Reflect.getMetadata(STATE_MACHINE_TRANSITION_META_KEY, TestSM, STATES.GAS)).toEqual([
			{
				name: TRANSITIONS.CONDENSE,
				from: STATES.GAS,
				to: STATES.LIQUID,
				before: [noop, noop],
				after: [],
			},
		]);
	});

	it("reflect several transition metadata", async () => {
		expect(
			Reflect.getMetadata(STATE_MACHINE_TRANSITION_META_KEY, TestSM, STATES.LIQUID)
		).toEqual([
			{
				name: TRANSITIONS.VAPORIZE,
				from: STATES.LIQUID,
				to: STATES.GAS,
				before: [noop],
				after: [],
			},
			{
				name: TRANSITIONS.FREEZE,
				from: STATES.LIQUID,
				to: STATES.SOLID,
				before: [noop],
				after: [],
			},
		]);
	});

	describe("State Machine Class Adapter", () => {
		it("should return right state", () => {
			expect(TestSM.state).toBe(STATES.LIQUID);
		});

		it("should return right available states", () => {
			expect(TestSM.states).toEqual(expect.arrayContaining([STATES.GAS, STATES.SOLID]));
		});

		it("should return right all states", () => {
			expect(TestSM.allStates).toEqual(
				expect.arrayContaining([STATES.SOLID, STATES.LIQUID, STATES.PLASMA, STATES.GAS])
			);
		});

		it("should return right available transitions", () => {
			expect(TestSM.transitions).toEqual(
				expect.arrayContaining([TRANSITIONS.VAPORIZE, TRANSITIONS.FREEZE])
			);
		});

		it("should return right all transitions", () => {
			expect(TestSM.allTransitions).toEqual(
				expect.arrayContaining([
					TRANSITIONS.CONDENSE,
					TRANSITIONS.VAPORIZE,
					TRANSITIONS.FREEZE,
				])
			);
		});

		it(`should return right "isPending" flag`, () => {
			expect(TestSM.isPending).toBe(false);
			TestSM.transitTo(STATES.SOLID);
			expect(TestSM.isPending).toBe(true);
		});

		it(`right "is" predicate `, async () => {
			expect(TestSM.is(STATES.PLASMA)).toBe(false);
			expect(TestSM.is(() => STATES.LIQUID)).toBe(true);
			expect(TestSM.is(await Promise.resolve(STATES.LIQUID))).toBe(true);
			expect(TestSM.is(await Promise.resolve(STATES.LIQUID))).toBe(true);
		});

		it(`right "canTransitTo" predicate`, async () => {
			expect(TestSM.canTransitTo(STATES.PLASMA)).toBe(false);
			expect(TestSM.canTransitTo(() => STATES.LIQUID)).toBe(false);
			expect(await TestSM.canTransitTo(Promise.resolve(STATES.SOLID))).toBe(true);
			expect(TestSM.canTransitTo(STATES.GAS)).toBe(true);
			expect(TestSM.canTransitTo(() => STATES.GAS)).toBe(true);
			expect(await TestSM.canTransitTo(Promise.resolve(STATES.GAS))).toBe(true);
		});

		it("should not pass 'canTransitTo' predicate", async () => {
			expect(TestSM.canTransitTo(STATES.GAS)).toBe(true);
			expect(TestSM.canTransitTo(() => STATES.GAS)).toBe(true);
			expect(await TestSM.canTransitTo(Promise.resolve(STATES.GAS))).toBe(true);
		});

		it("should pass 'canDoTransition' predicate", async () => {
			expect(TestSM.canDoTransition(TRANSITIONS.MELT)).toBe(false);
			expect(TestSM.canDoTransition(() => TRANSITIONS.MELT)).toBe(false);
			expect(await TestSM.canDoTransition(Promise.resolve(TRANSITIONS.MELT))).toBe(false);
		});

		it("should set right data", () => {
			expect(TestSM.deg).toEqual("+5 C");
		});

		it(`check "transitTo" passed arguments`, async () => {
			let passedArgs!: number[];
			TestSM.onBeforeTransition(function(_lifecycle: any, ...args: number[]) {
				passedArgs = args;
			});
			await TestSM.transitTo(STATES.GAS, 1, 2, 3);
			expect(passedArgs).toEqual([1, 2, 3]);
		});

		it(`check "doTransition" passed arguments`, async () => {
			let passedArgs!: number[];
			TestSM.onBeforeTransition((_lifecycle: any, ...args: number[]) => {
				passedArgs = args;
			});
			await TestSM.doTransition(TRANSITIONS.VAPORIZE, 1, 2, 3);
			expect(passedArgs).toEqual([1, 2, 3]);
		});

		describe("State Machine Class Adapter: Throw", () => {
			it(`"doTransition" throw StateMachineError#PENDING_STATE`, async () => {
				await TestSM.doTransition(TRANSITIONS.VAPORIZE);
				expect(TestSM.isPending).toBe(false);
				TestSM.doTransition(TRANSITIONS.CONDENSE);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.doTransition(TRANSITIONS.VAPORIZE);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"transitTo" throw StateMachineError#PENDING_STATE`, async () => {
				await TestSM.transitTo(STATES.GAS);
				expect(TestSM.isPending).toBe(false);
				TestSM.transitTo(STATES.LIQUID);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.transitTo(STATES.GAS);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"is" throw StateMachineError#PENDING_STATE`, async () => {
				const testPromise = new Promise<STATES>(resolve => {
					setTimeout(() => {
						resolve(STATES.LIQUID);
					}, 0);
				});
				await TestSM.is(testPromise);
				TestSM.is(() => STATES.LIQUID);
				TestSM.is(STATES.LIQUID);
				expect(TestSM.isPending).toBe(false);
				TestSM.is(testPromise);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.is(Promise.resolve(STATES.SOLID));
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"canTransitTo" throw StateMachineError#PENDING_STATE`, async () => {
				const testPromise = new Promise<STATES>(resolve => {
					setTimeout(() => {
						resolve(STATES.LIQUID);
					}, 0);
				});
				await TestSM.canTransitTo(testPromise);
				TestSM.canTransitTo(() => STATES.LIQUID);
				TestSM.canTransitTo(STATES.LIQUID);
				expect(TestSM.isPending).toBe(false);
				TestSM.canTransitTo(testPromise);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.canTransitTo(Promise.resolve(STATES.SOLID));
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"canDoTransition" throw StateMachineError#PENDING_STATE`, async () => {
				const testPromise = new Promise<TRANSITIONS>(resolve => {
					setTimeout(() => {
						resolve(TRANSITIONS.CONDENSE);
					}, 0);
				});
				await TestSM.canDoTransition(testPromise);
				TestSM.canDoTransition(() => TRANSITIONS.CONDENSE);
				TestSM.canDoTransition(TRANSITIONS.CONDENSE);
				expect(TestSM.isPending).toBe(false);
				TestSM.canDoTransition(testPromise);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.canDoTransition(Promise.resolve(TRANSITIONS.CONDENSE));
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});
		});
	});
});
