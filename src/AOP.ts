import "reflect-metadata";
import {
	Arrayable,
	Callable,
	ICancelableHook,
	IState,
	ITransition,
	Source,
	Thenable,
} from "./types";
import StateMachine from "./StateMachine";
import { StateMachineError } from "./Error";

// type Constructor<T = {}> = new (...args: any[]) => T;

// export const STATE_MACHINE_META_KEY = Symbol("STATE_MACHINE_META_KEY");
export const STATE_MACHINE_STATE_META_KEY = Symbol("#STATE_MACHINE:STATE");
export const STATE_MACHINE_TRANSITION_META_KEY = Symbol("#STATE_MACHINE:TRANSITION");

// function isInEnum<T>(str: keyof T, en: T): str is keyof T {
// 	// EXAMPLE: console.log("isInEnum", isInEnum("MELT", TRANSITIONS));
// 	return en[str] !== undefined;
// }

const InnerStore = new WeakMap<
	StateMachineClassAdapter<any, any, any>,
	StateMachine<any, any, any>
>();

export const STATE_MACHINE_INSTANCE = Symbol("#STATE_MACHINE:CLASS_ADAPTER:INSTANCE");
export const STATE_MACHINE_CLASS_ADAPTER_SET_PROPERTIES = Symbol(
	"#STATE_MACHINE:CLASS_ADAPTER:SET_PROPERTIES"
);

export class StateMachineClassAdapter<S = string | symbol, T = string | symbol, D = any> {
	private get [STATE_MACHINE_INSTANCE](): StateMachine<S, T, D> {
		return InnerStore.get(this) as StateMachine<S, T, D>;
	}

	public get isPending(): boolean {
		return this[STATE_MACHINE_INSTANCE].isPending;
	}

	public canTransitTo(stateName: Callable<IState<S, T, D>["name"]>): boolean;
	public canTransitTo(stateName: PromiseLike<IState<S, T, D>["name"]>): Promise<boolean>;
	public canTransitTo(stateName: Source<IState<S, T, D>["name"]>): Thenable<boolean> {
		return this[STATE_MACHINE_INSTANCE].canTransitTo(stateName);
	}

	public canDoTransition(transitionName: Callable<ITransition<S, T, D>["name"]>): boolean;
	public canDoTransition(
		transitionName: PromiseLike<ITransition<S, T, D>["name"]>
	): Promise<boolean>;
	public canDoTransition(
		transitionName: Source<ITransition<S, T, D>["name"]>
	): Thenable<boolean> {
		return this[STATE_MACHINE_INSTANCE].canDoTransition(transitionName);
	}

	public is(availableState: Callable<IState<S, T, D>["name"]>): boolean;
	public is(availableState: PromiseLike<IState<S, T, D>["name"]>): Promise<boolean>;
	public is(availableState: Source<IState<S, T, D>["name"]>): Thenable<boolean> {
		return this[STATE_MACHINE_INSTANCE].is(availableState);
	}

	public get state(): IState<S, T, D>["name"] {
		return this[STATE_MACHINE_INSTANCE].state;
	}

	public get states(): IState<S, T, D>["name"][] {
		return this[STATE_MACHINE_INSTANCE].states;
	}

	public get allStates(): IState<S, T, D>["name"][] {
		return this[STATE_MACHINE_INSTANCE].allStates;
	}

	public get transitions(): ITransition<S, T, D>["name"][] {
		return this[STATE_MACHINE_INSTANCE].transitions;
	}

	public get allTransitions(): ITransition<S, T, D>["name"][] {
		return this[STATE_MACHINE_INSTANCE].allTransitions;
	}

	// TODO: COHENCE transitTo --> doTransition
	// TODO: Enshure with asyncrones
	public async transitTo(
		newStateName: Callable<IState<S, T, D>["name"]>,
		...args: any[]
	): Promise<this | never> {
		await this[STATE_MACHINE_INSTANCE].transitTo(newStateName, ...args);
		// TODO: ENSHURE AT THIS POINT --> . <--
		this[STATE_MACHINE_CLASS_ADAPTER_SET_PROPERTIES]();
		return this;
	}

	// TODO: Enshure with asyncrones
	public async doTransition(
		transitionName: Callable<ITransition<S, T, D>["name"]>,
		...args: any[]
	): Promise<this | never> {
		await this[STATE_MACHINE_INSTANCE].doTransition(transitionName, ...args);
		this[STATE_MACHINE_CLASS_ADAPTER_SET_PROPERTIES]();
		return this;
	}

	public [STATE_MACHINE_CLASS_ADAPTER_SET_PROPERTIES]() {
		// TODO:iterate ower instance properties
		Object.keys(this[STATE_MACHINE_INSTANCE].data).forEach(property => {
			if (Reflect.has(this, property)) {
				// TODO: STRICTER
				Reflect.set(this, property, (this[STATE_MACHINE_INSTANCE] as any).data[property]);
			} else {
				// TODO: Make StateMachineClassAdapterError extends StateMachineError
				throw new StateMachineError(
					`Class don't have property "${property}"`,
					StateMachineError.ERROR_CODE.ABSENT_PROPERTY
				);
			}
		});
	}

	/**
	 * Add handler or array of handlers on BeforeTransitionHook
	 */
	public onBeforeTransition(handlers: Arrayable<ICancelableHook<S, T, D>>): void {
		this[STATE_MACHINE_INSTANCE].onBeforeTransition(handlers);
	}

	/**
	 * Add handler or array of handlers on AfterTransitionHook
	 */
	public onAfterTransition(handlers: Arrayable<ICancelableHook<S, T, D>>): void {
		this[STATE_MACHINE_INSTANCE].onAfterTransition(handlers);
	}

	/**
	 * Add handler or array of handlers on BeforeStateHook
	 */
	public onBeforeState(handlers: Arrayable<ICancelableHook<S, T, D>>): void {
		this[STATE_MACHINE_INSTANCE].onBeforeState(handlers);
	}

	/**
	 * Add handler or array of handlers on AfterStateHook
	 */
	public onAfterState(handlers: Arrayable<ICancelableHook<S, T, D>>): void {
		this[STATE_MACHINE_INSTANCE].onAfterState(handlers);
	}
}

export function TFSM(initialState: string): ClassDecorator {
	// TODO: STRICTER
	return function(target: Function): any {
		// the new constructor behaviour
		function newConstructor(...args: any[]): StateMachineClassAdapter<any, any, any> {
			const instance = Reflect.construct(target, args) as StateMachineClassAdapter<
				any,
				any,
				any
			>;
			// State Machine explore
			let stateMachineProps = Reflect.ownKeys(instance).reduce(
				({ transitions, states }, key) => {
					let statesMetadata: any[] = Reflect.getMetadata(
						STATE_MACHINE_STATE_META_KEY,
						instance,
						key as string
					);

					if (statesMetadata) {
						states = states.concat(
							...statesMetadata.map(stateMetadata => {
								stateMetadata.data = (instance as any)[key];
								return stateMetadata;
							})
						);
					}

					let transitionsMetadata: any[] = Reflect.getMetadata(
						STATE_MACHINE_TRANSITION_META_KEY,
						instance,
						key as string
					);

					if (transitionsMetadata) {
						transitions = transitions.concat(...transitionsMetadata);
					}

					return { transitions, states };
				},
				{ transitions: [], states: [] }
			);

			InnerStore.set(
				instance,
				new StateMachine(
					initialState,
					{ states: stateMachineProps.states },
					{ transitions: stateMachineProps.transitions }
				)
			);
			instance[STATE_MACHINE_CLASS_ADAPTER_SET_PROPERTIES]();

			// ! State Machine explore
			return instance;
		}

		// copy prototype so intanceof operator still works
		newConstructor.prototype = target.prototype;

		// return new constructor (will override original)
		return newConstructor;
	};
}

export function State<S = string | symbol, T = string | symbol, D = any>(
	name: IState<S, T, D>["name"],
	hooks?: {
		before?: ITransition<S, T, D>["before"];
		after?: ITransition<S, T, D>["after"];
	}
): PropertyDecorator {
	return function(target: Object, propertyKey: string | symbol) {
		let stateMetadata = Reflect.getMetadata(STATE_MACHINE_STATE_META_KEY, target, propertyKey);
		stateMetadata = stateMetadata || [];
		Reflect.defineMetadata(
			STATE_MACHINE_STATE_META_KEY,
			[
				{
					name,
					before: (hooks && hooks.before) || [],
					after: (hooks && hooks.after) || [],
				},
			].concat(stateMetadata),
			target,
			propertyKey
		);
	};
}

export function Transitable<S = string | symbol, T = string | symbol, D = any>(
	name: ITransition<S, T, D>["name"],
	from: ITransition<S, T, D>["from"],
	to: ITransition<S, T, D>["to"],
	hooks?: {
		before?: ITransition<S, T, D>["before"];
		after?: ITransition<S, T, D>["after"];
	}
): PropertyDecorator {
	return (target: Object, propertyKey: string | symbol): void => {
		let transitionMetadata = Reflect.getMetadata(
			STATE_MACHINE_TRANSITION_META_KEY,
			target,
			propertyKey
		);
		transitionMetadata = transitionMetadata || [];
		Reflect.defineMetadata(
			STATE_MACHINE_TRANSITION_META_KEY,
			[
				{
					name,
					from,
					to,
					before: (hooks && hooks.before) || [],
					after: (hooks && hooks.after) || [],
				},
			].concat(transitionMetadata),
			target,
			propertyKey
		);
	};
}
