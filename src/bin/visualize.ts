import StateMachine, { STATES, TRANSITIONS } from "../StateMachine";

export default function visualize(
	visualizedStateMachineClass: StateMachine<any, any, any>
): string {
	let result = "graph TD \n";
	let nodeCache: { [key: string]: number } = {};
	let nodeIndex = 1;

	function getNodeIdFromCache(nodeName: string): number {
		return nodeCache[nodeName] || (nodeCache[nodeName] = nodeIndex++);
	}

	visualizedStateMachineClass[TRANSITIONS].map((transition: any) => {
		const startNodeName = transition.from.toString();
		const finishNodeName = transition.to.toString();

		const startNodeState = (visualizedStateMachineClass as any)[STATES].find(
			(state: any) => state.name === startNodeName
		);
		const finishNodeState = (visualizedStateMachineClass as any)[STATES].find(
			(state: any) => state.name === finishNodeName
		);

		const startNodeId = getNodeIdFromCache(startNodeName);
		const finishNodeId = getNodeIdFromCache(transition.to);

		result += `    ${startNodeId}(${startNodeState.before.length} ${startNodeName} ${
			startNodeState.after.length
		}) --> |${transition.before.length} ${transition.name} ${
			transition.after.length
		}| ${finishNodeId}(${finishNodeState.before.length} ${finishNodeName} ${
			finishNodeState.after.length
		})\n`;
	});

	return result;
}
