import { _getArrayable, _getCallable, _getSource, _getThenable, _isPromiseLike } from "./helpers";
import {
	_IState,
	_ITransition,
	Arrayable,
	Callable,
	ICancelableHook,
	ICancelableHookResult,
	IObject,
	IState,
	ITransition,
	Source,
	Thenable,
} from "./types";
import { StateMachineError } from "./Error";

/**
 * Set state machine in pending state before method running.
 * Unsets state machine pending state after method finishes
 *
 * @method-decorator
 */
const Pendabel: MethodDecorator = <SM extends StateMachine<any, any, any>>(
	_target: Object,
	_propertyKey: string | symbol,
	descriptor: TypedPropertyDescriptor<any>
) => {
	let originalMethod = descriptor.value;
	descriptor.value = function(this: SM, arg: Thenable<any>) {
		if (this[PENDING_FLAG]) {
			const pendingError = new StateMachineError(
				`State Machine in pending state.`,
				StateMachineError.ERROR_CODE.PENDING_STATE
			);

			return Promise.reject(pendingError);
		} else {
			this[PENDING_FLAG] = true;
		}

		const result = originalMethod.call(this, arg);

		if (_isPromiseLike(result)) {
			return result.then(asyncResult => {
				this[PENDING_FLAG] = false;
				return asyncResult;
			});
		}

		this[PENDING_FLAG] = false;
		return result;
	};

	return descriptor;
};

export const TRANSITIONS = Symbol("STATE_MACHINE#TRANSITIONS");
export const STATES = Symbol("STATE_MACHINE#STATES");
const PENDING_FLAG = Symbol("STATE_MACHINE#PENDING_FLAG");
const TRANSPORT = Symbol("STATE_MACHINE#TRANSPORT");

/**
 * Creates state machine instance
 */
export default class StateMachine<S, T, D> {
	/**
	 * @type `{_ITransition<S, T, D>[]} Symbol("TRANSITIONS")` List of all possible transitions
	 */
	private [TRANSITIONS]: _ITransition<S, T, D>[] = [];

	/**
	 * @type `{_IState<S, T, D>[]} Symbol("STATES")` List of all possible states
	 */
	private [STATES]: _IState<S, T, D>[] = [];

	/**
	 * Current state of state machine
	 */
	private _currentState: _IState<S, T, D>;

	/**
	 * @type `{IObject} Symbol("TRANSPORT")` Transport object
	 */
	private [TRANSPORT]: IObject = {};

	/**
	 * @type `{boolean} Symbol("PENDING_FLAG")` Pending flag
	 */
	private [PENDING_FLAG]: boolean = false;

	/**
	 * List of handlers on BeforeEachStateHook
	 */
	private _beforeEachStateHandlers: ICancelableHook<S, T, D>[] = [];

	/**
	 * List of handlers on AfterEachStateHook
	 */
	private _afterEachStateHandlers: ICancelableHook<S, T, D>[] = [];

	/**
	 * List of handlers on BeforeEachTransitionHook
	 */
	private _beforeEachTransitionHandlers: ICancelableHook<S, T, D>[] = [];

	/**
	 * List of handlers on AfterEachTransitionHook
	 */
	private _afterEachTransitionHandlers: ICancelableHook<S, T, D>[] = [];

	public constructor(
		initialStateName: IState<S, T, D>["name"],
		states: {
			states: IState<S, T, D>[];
			before?: Arrayable<ICancelableHook<S, T, D>>;
			after?: Arrayable<ICancelableHook<S, T, D>>;
		},
		transitions: {
			transitions: ITransition<S, T, D>[];
			before?: Arrayable<ICancelableHook<S, T, D>>;
			after?: Arrayable<ICancelableHook<S, T, D>>;
		}
	) {
		this._beforeEachStateHandlers = states.before ? _getArrayable(states.before) : [];
		this._afterEachStateHandlers = states.after ? _getArrayable(states.after) : [];
		this[STATES] = this[STATES].concat(this._normalizeStates(states.states));

		this._beforeEachTransitionHandlers = transitions.before
			? _getArrayable(transitions.before)
			: [];
		this._afterEachTransitionHandlers = transitions.after
			? _getArrayable(transitions.after)
			: [];
		this[TRANSITIONS] = this[TRANSITIONS].concat(
			this._normalizeTransitions(transitions.transitions)
		);

		this._validate();

		const initialState = this._findStateByName(initialStateName);

		if (!initialState) {
			throw new StateMachineError(
				`State with name ${initialStateName} does not exist.`,
				StateMachineError.ERROR_CODE.ABSENT_STATE
			);
		}
		this._currentState = initialState;
	}

	/**
	 * Sync find out is state machine in expected state.
	 */
	public is(availableState: Callable<IState<S, T, D>["name"]>): boolean;
	/**
	 * Async find out is state machine in expected state.
	 *
	 * @pendabel
	 */
	public is(availableState: PromiseLike<IState<S, T, D>["name"]>): Promise<boolean>;
	/**
	 * Async or maybe sync find out is state machine in expected state.
	 *
	 * @pendabel
	 */
	public is(availableState: Source<IState<S, T, D>["name"]>): Thenable<boolean>;
	@Pendabel
	public is(availableState: Source<IState<S, T, D>["name"]>): Thenable<boolean> {
		if (_isPromiseLike(availableState)) {
			return availableState.then(
				resultAvailableState => this._currentState.name === resultAvailableState
			);
		} else {
			return this._currentState.name === _getCallable(availableState);
		}
	}

	/**
	 * Sync find out is can state machine go to specified state.
	 */
	public canTransitTo(stateName: Callable<IState<S, T, D>["name"]>): boolean;
	/**
	 * Async find out is can state machine go to specified state.
	 *
	 * @pendabel
	 */
	public canTransitTo(stateName: PromiseLike<IState<S, T, D>["name"]>): Promise<boolean>;
	/**
	 * Async or maybe sync find out is can state machine go to specified state.
	 *
	 * @pendabel
	 */
	public canTransitTo(stateName: Source<IState<S, T, D>["name"]>): Thenable<boolean>;
	@Pendabel
	public canTransitTo(stateName: Source<IState<S, T, D>["name"]>): Thenable<boolean> {
		if (_isPromiseLike(stateName)) {
			return stateName.then(resultAvailableState => this._canTransitTo(resultAvailableState));
		} else {
			stateName = _getCallable(stateName);
			return this._canTransitTo(stateName);
		}
	}

	/**
	 * Sync find out is can state machine do specified transition.
	 */
	public canDoTransition(transitionName: Callable<ITransition<S, T, D>["name"]>): boolean;
	/**
	 * Async find out is can state machine do specified transition.
	 *
	 * @pendable
	 */
	public canDoTransition(
		transitionName: PromiseLike<ITransition<S, T, D>["name"]>
	): Promise<boolean>;
	/**
	 * Async or maybe sync find out is can state machine do specified transition.
	 *
	 * @pendable
	 */
	public canDoTransition(transitionName: Source<ITransition<S, T, D>["name"]>): Thenable<boolean>;
	@Pendabel
	public canDoTransition(
		transitionName: Source<ITransition<S, T, D>["name"]>
	): Thenable<boolean> {
		if (_isPromiseLike(transitionName)) {
			return transitionName.then(resultAvailableState =>
				this._canDoTransition(resultAvailableState)
			);
		} else {
			transitionName = _getCallable(transitionName);
			return this._canDoTransition(transitionName);
		}
	}

	/**
	 * Is state machine in pending state
	 *
	 * @example
	 * stateMachine.isPending // true
	 */
	public get isPending(): boolean {
		return this[PENDING_FLAG];
	}

	/**
	 * Name of current state
	 *
	 * @example
	 * stateMachine.state // LIQUID
	 */
	public get state(): _IState<S, T, D>["name"] {
		return this._currentState.name;
	}

	/**
	 * Transport of current state
	 *
	 * @example
	 * stateMachine.transport // { some: "some", any: 2, nothing: null }
	 */
	public get transport(): IObject {
		return this[TRANSPORT];
	}

	/**
	 * Data of current state
	 *
	 * @example
	 * stateMachine.data // { some: "some", any: 2, nothing: null }
	 */
	public get data(): IState<S, T, D>["data"] {
		return this._currentState.data;
	}

	/**
	 * List of names of states that are available from the current state
	 *
	 * @example
	 * stateMachine.states // ["SOLID", "GAS"]
	 */
	public get states(): IState<S, T, D>["name"][] {
		return this._availableTransitions.map(transition => transition.to);
	}

	/**
	 * List of names of all possible states
	 *
	 * @example
	 * stateMachine.allStates // ["SOLID", "LIQUID", "GAS"]
	 */
	public get allStates(): IState<S, T, D>["name"][] {
		return this[STATES].map(state => state.name);
	}

	/**
	 * List of names of transitions that are available from the current state
	 *
	 * @example
	 * stateMachine.transitions // ["VAPORISE", "FREEZE"]
	 */
	public get transitions(): ITransition<S, T, D>["name"][] {
		return this._availableTransitions.map(transition => transition.name);
	}

	/**
	 * List of names of all possible transitions
	 *
	 * @example
	 * stateMachine.transitions // ["MELT", "VAPORISE", "CONDENSE", "FREEZE"]
	 */
	public get allTransitions(): ITransition<S, T, D>["name"][] {
		return this[TRANSITIONS].map(transition => transition.name);
	}

	/**
	 * Add handler or array of handlers on BeforeTransitionHook
	 */
	public onBeforeTransition(hooks: Arrayable<ICancelableHook<S, T, D>>): void {
		this._beforeEachTransitionHandlers = this._beforeEachTransitionHandlers.concat(hooks);
	}

	/**
	 * Add handler or array of handlers on AfterTransitionHook
	 */
	public onAfterTransition(hooks: Arrayable<ICancelableHook<S, T, D>>): void {
		this._afterEachTransitionHandlers = this._afterEachTransitionHandlers.concat(hooks);
	}

	/**
	 * Add handler or array of handlers on BeforeStateHook
	 */
	public onBeforeState(hooks: Arrayable<ICancelableHook<S, T, D>>): void {
		this._beforeEachStateHandlers = this._beforeEachStateHandlers.concat(hooks);
	}

	/**
	 * Add handler or array of handlers on AfterStateHook
	 */
	public onAfterState(hooks: Arrayable<ICancelableHook<S, T, D>>): void {
		this._afterEachStateHandlers = this._afterEachStateHandlers.concat(hooks);
	}

	/**
	 * Set state machine to pending state.
	 * Makes checks and transition to state with specified name.
	 *
	 * @pendable
	 *
	 * @throws {StateMachineError}
	 * ABSENT_STATE State with name "stateName" does not exist.
	 *
	 * @throws {StateMachineError}
	 * UNAVAILABLE_STATE State machine can't transition to state with name "stateName".
	 *
	 * @example
	 * stateMachine.transitTo(stateName) // Promise { stateMachine }
	 * stateMachine.transitTo(() => stateName) // Promise { stateMachine }
	 * stateMachine.transitTo(Promise.resolve(stateName)) // Promise { stateMachine }
	 */
	@Pendabel
	public async transitTo(stateName: Source<IState<S, T, D>["name"]>): Promise<this | never> {
		stateName = await _getSource(stateName);

		return this._checkAndTransitTo(stateName);
	}

	/**
	 * Set state machine to pending state.
	 * Makes checks and do transition with specified name.
	 *
	 * @pendable
	 *
	 * @throws {StateMachineError}
	 * ABSENT_TRANSITION Transition with name "transitionName" does not exist.
	 *
	 * @throws {StateMachineError}
	 * UNAVAILABLE_TRANSITION State machine can't do transition with name "transitionName".
	 *
	 * @example
	 * stateMachine.doTransition(transitionName) // Promise { stateMachine }
	 * stateMachine.doTransition(() => transitionName) // Promise { stateMachine }
	 * stateMachine.doTransition(Promise.resolve(transitionName)) // Promise { stateMachine }
	 */
	@Pendabel
	public async doTransition(
		transitionName: Source<ITransition<S, T, D>["name"]>
	): Promise<this | never> {
		transitionName = await _getSource(transitionName);

		return this._checkAndDoTransition(transitionName);
	}

	/**
	 * Makes checks and transition to state with specified name.
	 *
	 * @throws {StateMachineError}
	 * ABSENT_STATE State with name "stateName" does not exist.
	 *
	 * @throws {StateMachineError}
	 * UNAVAILABLE_STATE State machine can't transition to state with name "stateName".
	 */
	private async _checkAndTransitTo(stateName: _IState<S, T, D>["name"]): Promise<this | never> {
		const currentState = this._findStateByName(stateName);

		if (!currentState) {
			throw new StateMachineError(
				`State with name "${stateName}" does not exist.`,
				StateMachineError.ERROR_CODE.ABSENT_STATE
			);
		}

		if (!this._canTransitTo(stateName)) {
			throw new StateMachineError(
				`State machine can transit from ${
					this._currentState.name
				} only to ${this.states.join(", ")} but not to ${stateName}.`,
				StateMachineError.ERROR_CODE.UNAVAILABLE_STATE
			);
		}

		return this._transit(currentState, undefined);
	}

	/**
	 * Makes checks and do transition with specified name.
	 *
	 * @throws {StateMachineError}
	 * ABSENT_TRANSITION Transition with name "transitionName" does not exist.
	 *
	 * @throws {StateMachineError}
	 * UNAVAILABLE_TRANSITION State machine can't do transition with name "transitionName".
	 *
	 * @example
	 * stateMachine.doTransition("MELT") // Promise { stateMachine }
	 */
	private async _checkAndDoTransition(
		transitionName: _ITransition<S, T, D>["name"]
	): Promise<this | never> {
		const currentTransition = this[TRANSITIONS].find(
			transition => transition.name === transitionName
		);

		if (!currentTransition) {
			throw new StateMachineError(
				`Transition with name "${transitionName}" does not exist.`,
				StateMachineError.ERROR_CODE.ABSENT_TRANSITION
			);
		}

		if (!this._canDoTransition(currentTransition.name)) {
			throw new StateMachineError(
				`State machine can do "${this.transitions.join(
					","
				)}" transition(s) but not "${transitionName}".`,
				StateMachineError.ERROR_CODE.UNAVAILABLE_TRANSITION
			);
		}

		return this._transit(undefined, currentTransition);
	}

	/**
	 * Do state-based transition.
	 * If any of handlers from hooks returns false state machine stops transition and returns to previous state.
	 *
	 * @example
	 * stateMachine#_transit("LIQUID", undefined) // Promise { stateMachine }
	 */
	private async _transit(state: _IState<S, T, D>, transition: undefined): Promise<this>;
	/**
	 * Do transition-based transition.
	 *
	 * @example
	 * stateMachine#_transit(undefined, "MELT") // Promise { stateMachine }
	 */
	private async _transit(state: undefined, transition: _ITransition<S, T, D>): Promise<this>;
	private async _transit(
		state?: _IState<S, T, D>,
		transition?: _ITransition<S, T, D>
	): Promise<this> {
		let nextState!: _IState<S, T, D>;
		let currentTransition!: _ITransition<S, T, D>;

		if (state) {
			nextState = state as _IState<S, T, D>;
			currentTransition = this._availableTransitions.find(
				t => t.to === state.name
			) as _ITransition<S, T, D>;
		}

		if (transition) {
			nextState = this[STATES].find(s => s.name === transition.to) as _IState<S, T, D>;
			currentTransition = transition;
		}

		// 1 AES: After Each State Hook
		const isOkAfterEachStateHook: boolean = await this._runHooks(
			this._afterEachStateHandlers,
			this._currentState,
			nextState
		);

		if (!isOkAfterEachStateHook) {
			return this;
		}

		// 2 AS: After State Hook
		const isOkAfterStateHook: boolean = await this._runHooks(
			this._currentState.after,
			this._currentState,
			nextState
		);

		if (!isOkAfterStateHook) {
			return this;
		}

		// 3 BET: Before Each Transition Hook
		const isOkBeforeEachTransitionHook: boolean = await this._runHooks(
			this._beforeEachTransitionHandlers,
			this._currentState,
			nextState
		);

		if (!isOkBeforeEachTransitionHook) {
			return this;
		}

		// 4 BT: Before Transition Hook
		const isOkBeforeTransitionHook: boolean = await this._runHooks(
			currentTransition.before,
			this._currentState,
			nextState
		);

		if (!isOkBeforeTransitionHook) {
			return this;
		}

		// change state
		const lastState = this._currentState;
		this._currentState = nextState;

		// 5 AT: After transition hook
		const isOkAfterTransitionHook: boolean = await this._runHooks(
			currentTransition.after,
			lastState,
			this._currentState
		);

		if (!isOkAfterTransitionHook) {
			this._currentState = lastState;
			return this;
		}

		// 6 AET: After each transition hook
		const isOkAfterEachTransitionHook: boolean = await this._runHooks(
			this._afterEachTransitionHandlers,
			lastState,
			this._currentState
		);

		if (!isOkAfterEachTransitionHook) {
			this._currentState = lastState;
			return this;
		}

		// 7 BS: Before new state hook
		const isOkBeforeStateHook: boolean = await this._runHooks(
			this._currentState.before,
			lastState,
			this._currentState
		);

		if (!isOkBeforeStateHook) {
			this._currentState = lastState;
			return this;
		}

		// 8 BES: Before each state hook
		const isOkBeforeEachStateHook: boolean = await this._runHooks(
			this._beforeEachStateHandlers,
			lastState,
			this._currentState
		);

		if (!isOkBeforeEachStateHook) {
			this._currentState = lastState;
			return this;
		}

		return this;
	}

	private _findStateByName(name: IState<S, T, D>["name"]): _IState<S, T, D> | void {
		return this[STATES].find(state => state.name === name);
	}

	/**
	 * List of transitions that are available from the current state
	 */
	private get _availableTransitions(): _ITransition<S, T, D>[] {
		return this[TRANSITIONS].filter(transition => this._currentState.name === transition.from);
	}

	/**
	 * Find out is can state machine go to specified state.
	 */
	private _canTransitTo(stateName: IState<S, T, D>["name"]): boolean {
		return this.states.some(state => state === stateName);
	}

	/**
	 * Find out is can state machine do specified transition.
	 */
	private _canDoTransition(transitionName: ITransition<S, T, D>["name"]): boolean {
		return this.transitions.some(stateName => stateName === transitionName);
	}

	/**
	 * Convert transitions with optional properties from API to transitions with required properties for internal use.
	 */
	private _normalizeTransitions(
		transitions: Arrayable<ITransition<S, T, D>>
	): _ITransition<S, T, D>[] {
		return _getArrayable(transitions).map(transition => ({
			name: transition.name,
			from: transition.from,
			to: transition.to,
			before: transition.before ? _getArrayable(transition.before) : [],
			after: transition.after ? _getArrayable(transition.after) : [],
		}));
	}

	/**
	 * Convert states with optional properties from API to states with required properties for internal use.
	 */
	private _normalizeStates(states: Arrayable<IState<S, T, D>>): _IState<S, T, D>[] {
		return _getArrayable(states).map(state => ({
			name: state.name,
			data: state.data,
			before: state.before ? _getArrayable(state.before) : [],
			after: state.after ? _getArrayable(state.after) : [],
		}));
	}

	/**
	 * Check the correspondence of transitions and states
	 *
	 * @throws {StateMachineError}
	 * DUPLICATED_STATE There are duplicated states.
	 *
	 * @throws {StateMachineError}
	 * ABSENT_STATE There is no state from which the transition begins.
	 *
	 * @throws {StateMachineError}
	 * ABSENT_STATE There is no state in which the transition leads.
	 *
	 * @throws {StateMachineError}
	 * DUPLICATED_TRANSITION There are duplicated transitions "${transition.name}" from "${transition.from}" state.
	 */
	private _validate(): void | never {
		this[STATES].forEach((state, stateIndex, allStates) => {
			const isExistDuplicatedStates = allStates.some(
				(inspectedState, inspectedStateIndex) =>
					inspectedStateIndex !== stateIndex && inspectedState.name === state.name
			);

			if (isExistDuplicatedStates) {
				throw new StateMachineError(
					`There are duplicated states "${state.name}".`,
					StateMachineError.ERROR_CODE.DUPLICATED_STATE
				);
			}
		});

		this[TRANSITIONS].forEach((transition, transitionIndex, allTransitions) => {
			const isExistTransitionFromState = this.allStates.some(
				stateName => stateName === transition.from
			);

			if (!isExistTransitionFromState) {
				throw new StateMachineError(
					`There is no state "${transition.from}" FROM which the transition "${
						transition.name
					}" begins.`,
					StateMachineError.ERROR_CODE.ABSENT_STATE
				);
			}

			const isExistTransitionToState = this.allStates.some(
				stateName => stateName === transition.to
			);

			if (!isExistTransitionToState) {
				throw new StateMachineError(
					`There is no state "${transition.to}" in which the transition "${
						transition.name
					}" leads.`,
					StateMachineError.ERROR_CODE.ABSENT_STATE
				);
			}

			const isExistDuplicatedTransition = allTransitions.some(
				(inspectedTransition, inspectedTransitionIndex) =>
					inspectedTransitionIndex !== transitionIndex &&
					inspectedTransition.from === transition.from &&
					inspectedTransition.name === transition.name
			);

			if (isExistDuplicatedTransition) {
				throw new StateMachineError(
					`There are duplicated transitions "${transition.name}" from "${
						transition.from
					}" state.`,
					StateMachineError.ERROR_CODE.DUPLICATED_TRANSITION
				);
			}
		});
	}

	/**
	 * Iterated over an array of handlers, alternately calling them.
	 * If one of the handlers returned the false, then the subsequent handlers are not called.
	 */
	private async _runHooks(
		hooks: ICancelableHook<S, T, D>[],
		from: _IState<S, T, D>,
		to: _IState<S, T, D>
	): Promise<boolean> {
		return (
			false !==
			(await hooks.reduce<ICancelableHookResult>(async (acc, callback) => {
				if ((await acc) === false) {
					return false;
				} else {
					return _getThenable<ICancelableHookResult>(
						callback.call(this, this[TRANSPORT], from, to)
					);
				}
			}, Promise.resolve(true)))
		);
	}
}
