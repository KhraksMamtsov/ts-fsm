import StateMachine from "../src/StateMachine";
import { StateMachineError } from "../src/Error";
import { IObject, IState, ITransition } from "../src/types";

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
	SUBLIMATION = "SUBLIMATION",
	DESUBLIMATION = "DESUBLIMATION",
	RECOMBINATION = "RECOMBINATION",
	IONIZATION = "IONIZATION",
}

type temperature = number;

let TestSM: StateMachine<STATES, TRANSITIONS, temperature>;
let transitions: ITransition<STATES, TRANSITIONS, temperature>[];
let states: IState<STATES, TRANSITIONS, temperature>[];

describe("State Machine", () => {
	beforeEach(() => {
		transitions = [
			{
				name: TRANSITIONS.MELT,
				from: STATES.SOLID,
				to: STATES.LIQUID,
			},
			{
				name: TRANSITIONS.FREEZE,
				from: STATES.LIQUID,
				to: STATES.SOLID,
			},
			{
				name: TRANSITIONS.VAPORIZE,
				from: STATES.LIQUID,
				to: STATES.GAS,
			},
			{
				name: TRANSITIONS.CONDENSE,
				from: STATES.GAS,
				to: STATES.LIQUID,
				before: [
					() => {
						return new Promise(resolve => {
							setTimeout(() => {
								resolve(true);
							}, 5);
						});
					},
				],
			},
		];

		states = [
			{
				name: STATES.SOLID,
				data: -100,
			},
			{
				name: STATES.LIQUID,
				data: 50,
			},
			{
				name: STATES.GAS,
				data: 200,
			},
		];
		const increaseEntropy = (transport: IObject) => {
			transport["entropy"] =
				transport["entropy"] === undefined ? 0 : transport["entropy"] + 1;
		};

		TestSM = new StateMachine<STATES, TRANSITIONS, temperature>(
			STATES.SOLID,
			{
				states,
			},
			{
				transitions,
				after: increaseEntropy,
			}
		);
	});

	it("should exist", () => {
		expect(TestSM).toBeDefined();
	});

	it("should be initialized with right state", () => {
		expect(TestSM.state).toBe(STATES.SOLID);
	});

	it(`should pass "is" predicate`, async () => {
		expect(await TestSM.is(Promise.resolve(STATES.SOLID))).toBe(true);
		expect(TestSM.is(STATES.SOLID)).toBe(true);
		expect(TestSM.is(() => STATES.SOLID)).toBe(true);
	});

	it("should not pass 'is' predicate", async () => {
		expect(await TestSM.is(STATES.LIQUID)).toBe(false);
		expect(await TestSM.is(() => STATES.LIQUID)).toBe(false);
	});

	it("should pass 'canTransitTo' predicate", async () => {
		expect(TestSM.canTransitTo(STATES.LIQUID)).toBe(true);
		expect(TestSM.canTransitTo(() => STATES.LIQUID)).toBe(true);
		expect(await TestSM.canTransitTo(Promise.resolve(STATES.LIQUID))).toBe(true);
	});

	it("should not pass 'canTransitTo' predicate", async () => {
		expect(TestSM.canTransitTo(STATES.GAS)).toBe(false);
		expect(TestSM.canTransitTo(() => STATES.GAS)).toBe(false);
		expect(await TestSM.canTransitTo(Promise.resolve(STATES.GAS))).toBe(false);
	});

	it("should pass 'canDoTransition' predicate", async () => {
		expect(TestSM.canDoTransition(TRANSITIONS.MELT)).toBe(true);
		expect(TestSM.canDoTransition(() => TRANSITIONS.MELT)).toBe(true);
		expect(await TestSM.canDoTransition(Promise.resolve(TRANSITIONS.MELT))).toBe(true);
	});

	it("should not pass 'canDoTransition' predicate", async () => {
		expect(TestSM.canDoTransition(TRANSITIONS.CONDENSE)).toBe(false);
		expect(TestSM.canDoTransition(() => TRANSITIONS.CONDENSE)).toBe(false);
		expect(await TestSM.canDoTransition(Promise.resolve(TRANSITIONS.CONDENSE))).toBe(false);
	});

	it(`should transit to ${STATES.LIQUID}`, async () => {
		expect((await TestSM.transitTo(STATES.LIQUID)).state).toBe(STATES.LIQUID);
	});

	it(`should transit to () => ${STATES.LIQUID}`, async () => {
		expect((await TestSM.transitTo(() => STATES.LIQUID)).state).toBe(STATES.LIQUID);
	});

	it("should return right state after several transitions", async () => {
		expect((await TestSM.transitTo(STATES.LIQUID)).state).toBe(STATES.LIQUID);
		expect((await TestSM.transitTo(STATES.GAS)).state).toBe(STATES.GAS);
	});

	it("should return all possible states", () => {
		expect(TestSM.allStates).toEqual(states.map(state => state.name));
	});

	it("should return all possible transitions", () => {
		expect(TestSM.allTransitions).toEqual(transitions.map(transition => transition.name));
	});

	it("should return list of transitions that are allowed from the current state", () => {
		expect(TestSM.transitions).toEqual([transitions[0].name]);
	});

	it("should return right pending state", async () => {
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.isPending).toBe(false);
	});

	it("should return right pending state", async () => {
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.isPending).toBe(false);
		TestSM.transitTo(STATES.GAS);
		expect(TestSM.isPending).toBe(true);
	});

	it("check transport state", async () => {
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.transport.entropy).toBe(0);
		await TestSM.transitTo(STATES.GAS);
		expect(TestSM.transport.entropy).toBe(1);
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.transport.entropy).toBe(2);
		await TestSM.transitTo(STATES.SOLID);
		expect(TestSM.transport.entropy).toBe(3);
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.transport.entropy).toBe(4);
	});

	it("check dehydration", async () => {
		expect(TestSM.dehydrated).toEqual({
			state: STATES.SOLID,
			data: -100,
			transport: {},
		});
		await TestSM.transitTo(STATES.LIQUID);
		expect(TestSM.dehydrated).toEqual({
			state: STATES.LIQUID,
			data: 50,
			transport: {
				entropy: 0,
			},
		});
		await TestSM.transitTo(STATES.GAS);
		expect(TestSM.dehydrated).toEqual({
			state: STATES.GAS,
			data: 200,
			transport: {
				entropy: 1,
			},
		});
	});

	it("check dehydration immutability", async () => {
		expect(TestSM.dehydrated).not.toBe(TestSM.dehydrated);
	});

	it("check hydration", async () => {
		let dehydratedState = TestSM.dehydrated;
		expect(dehydratedState).toEqual({
			state: STATES.SOLID,
			data: -100,
			transport: {},
		});
		await TestSM.transitTo(STATES.LIQUID);
		await TestSM.transitTo(STATES.GAS);
		expect(TestSM.dehydrated).toEqual({
			state: STATES.GAS,
			data: 200,
			transport: {
				entropy: 1,
			},
		});
		TestSM.hydrate(dehydratedState);
		expect(TestSM.dehydrated).toEqual({
			state: STATES.SOLID,
			data: -100,
			transport: {},
		});
	});

	describe("State Machine: Throws", () => {
		describe(`"constructor" throw StateMachineError`, () => {
			it(`"constructor" throw StateMachineError#ABSENT_STATE`, () => {
				try {
					// tslint:disable-next-line:no-unused-expression
					new StateMachine(
						STATES.PLASMA, // ABSENT_STATE
						{ states: [] },
						{ transitions: [] }
					);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.ABSENT_STATE);
				}
			});

			it(`"constructor" throw StateMachineError#DUPLICATED_STATE`, () => {
				try {
					// tslint:disable-next-line:no-unused-expression
					new StateMachine(
						STATES.SOLID,
						{
							states: [
								{ name: STATES.SOLID, data: {} },
								{ name: STATES.SOLID, data: {} },
							],
						},
						{ transitions: [] }
					);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.DUPLICATED_STATE
					);
				}
			});

			it(`"constructor" throw StateMachineError#DUPLICATED_TRANSITION`, () => {
				try {
					// tslint:disable-next-line:no-unused-expression
					new StateMachine(
						STATES.SOLID,
						{
							states: [
								{ name: STATES.SOLID, data: {} },
								{ name: STATES.LIQUID, data: {} },
							],
						},
						{
							transitions: [
								{
									name: TRANSITIONS.MELT, // DUPLICATED_TRANSITION
									from: STATES.SOLID,
									to: STATES.LIQUID,
								},
								{
									name: TRANSITIONS.MELT, // DUPLICATED_TRANSITION
									from: STATES.SOLID,
									to: STATES.LIQUID,
								},
							],
						}
					);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.DUPLICATED_TRANSITION
					);
				}
			});

			it(`"constructor" throw StateMachineError#ABSENT_STATE (to)`, () => {
				try {
					// tslint:disable-next-line:no-unused-expression
					new StateMachine(
						STATES.SOLID,
						{
							states: [
								{ name: STATES.SOLID, data: {} },
								{ name: STATES.LIQUID, data: {} },
							],
						},
						{
							transitions: [
								{
									name: TRANSITIONS.MELT,
									from: STATES.SOLID,
									to: STATES.GAS, // ABSENT_STATE to
								},
							],
						}
					);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.ABSENT_STATE);
				}
			});

			it(`"constructor" throw StateMachineError#ABSENT_STATE (from)`, () => {
				try {
					// tslint:disable-next-line:no-unused-expression
					new StateMachine(
						STATES.SOLID,
						{
							states: [
								{ name: STATES.SOLID, data: {} },
								{ name: STATES.LIQUID, data: {} },
							],
						},
						{
							transitions: [
								{
									name: TRANSITIONS.MELT,
									from: STATES.GAS, // ABSENT_STATE from
									to: STATES.LIQUID,
								},
							],
						}
					);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.ABSENT_STATE);
				}
			});
		});

		describe(`"doTransition" throw StateMachineError`, () => {
			it(`"doTransition" throw StateMachineError#${
				StateMachineError.ERROR_CODE.PENDING_STATE
			}`, async () => {
				await TestSM.doTransition(TRANSITIONS.MELT);
				expect(TestSM.isPending).toBe(false);
				TestSM.doTransition(TRANSITIONS.VAPORIZE);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.doTransition(TRANSITIONS.MELT);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"doTransition" throw StateMachineError#${
				StateMachineError.ERROR_CODE.ABSENT_TRANSITION
			}`, async () => {
				try {
					await TestSM.doTransition(TRANSITIONS.SUBLIMATION);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.ABSENT_TRANSITION
					);
				}
			});

			it(`"doTransition" throw StateMachineError#${
				StateMachineError.ERROR_CODE.UNAVAILABLE_TRANSITION
			}`, async () => {
				try {
					await TestSM.doTransition(TRANSITIONS.VAPORIZE);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.UNAVAILABLE_TRANSITION
					);
				}
			});
		});

		describe(`"transitTo" throw StateMachineError`, () => {
			it(`"transitTo" throw StateMachineError#${
				StateMachineError.ERROR_CODE.PENDING_STATE
			}`, async () => {
				await TestSM.transitTo(STATES.LIQUID);
				expect(TestSM.isPending).toBe(false);
				TestSM.transitTo(STATES.GAS);
				expect(TestSM.isPending).toBe(true);

				try {
					await TestSM.transitTo(STATES.LIQUID);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.PENDING_STATE
					);
				}
			});

			it(`"transitTo" throw StateMachineError#${
				StateMachineError.ERROR_CODE.ABSENT_STATE
			}`, async () => {
				try {
					await TestSM.transitTo(STATES.PLASMA);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.ABSENT_STATE);
				}
			});

			it(`"transitTo" throw StateMachineError#${
				StateMachineError.ERROR_CODE.UNAVAILABLE_STATE
			}`, async () => {
				try {
					await TestSM.transitTo(STATES.SOLID);
				} catch (error) {
					expect(error).toBeInstanceOf(StateMachineError);
					expect(error).toHaveProperty(
						"code",
						StateMachineError.ERROR_CODE.UNAVAILABLE_STATE
					);
				}
			});
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
				expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.PENDING_STATE);
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
				expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.PENDING_STATE);
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
				expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.PENDING_STATE);
			}
		});

		it(`"hydrate" throw StateMachineError#ABSENT_STATE`, async () => {
			let dehydratedState = TestSM.dehydrated;
			expect(dehydratedState).toEqual({
				state: STATES.SOLID,
				data: -100,
				transport: {},
			});
			await TestSM.transitTo(STATES.LIQUID);
			await TestSM.transitTo(STATES.GAS);
			expect(TestSM.dehydrated).toEqual({
				state: STATES.GAS,
				data: 200,
				transport: {
					entropy: 1,
				},
			});

			try {
				TestSM.hydrate({
					state: STATES.PLASMA,
					data: -100,
					transport: {},
				});
			} catch (error) {
				expect(error).toBeInstanceOf(StateMachineError);
				expect(error).toHaveProperty("code", StateMachineError.ERROR_CODE.ABSENT_STATE);
			}
		});
	});
});
