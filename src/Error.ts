export enum StateMachineErrorCode {
	PENDING_STATE = "PENDING_STATE",

	ABSENT_STATE = "ABSENT_STATE",
	UNAVAILABLE_STATE = "UNAVAILABLE_STATE",
	DUPLICATED_STATE = "DUPLICATED_STATE",

	ABSENT_TRANSITION = "ABSENT_TRANSITION",
	UNAVAILABLE_TRANSITION = "UNAVAILABLE_TRANSITION",
	DUPLICATED_TRANSITION = "DUPLICATED_TRANSITION",

	ABSENT_PROPERTY = "ABSENT_PROPERTY",
}

/**
 * Class for state machine errors
 */
export class StateMachineError extends Error {
	/**
	 * Set of possible error codes
	 */
	public static ERROR_CODE = StateMachineErrorCode;

	/**
	 * Error code to indicate a specific error
	 */
	public code: string;

	public constructor(message: string, code: string) {
		super(message);
		this.code = code;

		// Set the prototype explicitly.
		Object.setPrototypeOf(this, StateMachineError.prototype);
	}
}
