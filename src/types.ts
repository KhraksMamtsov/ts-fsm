import StateMachine from "./StateMachine";

export type Arrayable<T> = T | T[];
export type Callable<T> = T | (() => T);
export type Thenable<T> = T | PromiseLike<T>;
export type Source<T> = T | (() => T) | PromiseLike<T>;

/**
 * Type of state name
 * @typedef {S} IState<S, T, D>["name"]
 */
export interface IState<S = string | symbol, T = string | symbol, D = any> {
	name: S;
	data: D;
	before?: Arrayable<ICancelableHook<S, T, D>>;
	after?: Arrayable<ICancelableHook<S, T, D>>;
}

export interface ITransition<S = string | symbol, T = string | symbol, D = any> {
	name: T;
	from: IState<S, T, D>["name"];
	to: IState<S, T, D>["name"];
	before?: Arrayable<ICancelableHook<S, T, D>>;
	after?: Arrayable<ICancelableHook<S, T, D>>;
}

// tslint:disable-next-line:class-name
export interface _ITransition<S, T, D> extends ITransition<S, T, D> {
	before: ICancelableHook<S, T, D>[];
	after: ICancelableHook<S, T, D>[];
}

// tslint:disable-next-line:class-name
export interface _IState<S, T, D> extends IState<S, T, D> {
	before: ICancelableHook<S, T, D>[];
	after: ICancelableHook<S, T, D>[];
}

export type ICancelableHook<S, T, D> = (
	this: StateMachine<S, T, D>,
	container: IObject,
	from: _IState<S, T, D>,
	to: _IState<S, T, D>
) => ICancelableHookResult;

export type ICancelableHookResult = Thenable<void | boolean>;
export type IObject = {
	[key: string]: any;
	[key: number]: any;
	// [key: symbol]: any;
};

export interface IHydratedState<S, D> {
	state: S;
	data: D;
	transport: IObject;
}
