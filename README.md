![GitHub top language](https://img.shields.io/github/languages/top/KhraksMamtsov/ts-fsm.svg?style=flat-square)
![npm type definitions](https://img.shields.io/npm/types/ts-fsm.svg?style=flat-square)
[![Build Status](https://img.shields.io/travis/KhraksMamtsov/ts-fsm/master.svg?style=flat-square)](https://travis-ci.org/KhraksMamtsov/ts-fsm)
[![Coverage Status](https://img.shields.io/coveralls/github/KhraksMamtsov/ts-fsm/master.svg?style=flat-square)](https://coveralls.io/github/KhraksMamtsov/ts-fsm?branch=master)
[![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/ts-fsm.svg?style=flat-square)](https://bundlephobia.com/result?p=ts-fsm)
[![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/ts-fsm.svg?style=flat-square)](https://bundlephobia.com/result?p=ts-fsm)
![license](https://img.shields.io/github/license/KhraksMamtsov/ts-fsm.svg?style=flat-square)




# Finite state machine written in typescript

Advanced control of entities' lifecycle.

```cmd
npm install ts-fsm
yarn add ts-fsm
```

## Simple usage

```typescript
import StateMachine from "ts-fsm";

enum STATE {
    SOLID = "SOLID",
    LIQUID = "LIQUID",
    GAS = "GAS",
} 

enum TRANSITION {
    MELT = "MELT",
    VAPORIZE = "VAPORIZE",
    CONDENSE = "CONDENSE",
    FREEZE = "FREEZE",
}

interface IDATA {
    temperature: number;
}

const states = [{
    name: STATE.SOLID,
    data: { temperature: -100 },
}, {
    name: STATE.LIQUID,
    data: { temperature: 50 },
}, {
    name: STATE.GAS,
    data: { temperature: 200 },
}];

const transitions = [{
    name: TRANSITION.MELT,
    from: STATE.SOLID,
    to: STATE.LIQUID,
}, {
    name: TRANSITION.FREEZE,
    from: STATE.LIQUID,
    to: STATE.SOLID,
}, {
    name: TRANSITION.VAPORIZE,
    from: STATE.LIQUID,
    to: STATE.GAS,
}, {
    name: TRANSITION.CONDENSE,
    from: STATE.GAS,
    to: STATE.LIQUID,
}];

const sm = new StateMachine<STATE, TRANSITION, IDATA>(STATE.SOLID, states, transitions);

sm.state // "SOLID"
sm.data // { temperature: -100 }

sm.transitTo(STATE.LIQUID) // Promise { sm }
   .then(sm => {
       sm.state; // "LIQUID"
       sm.data; // { temperature: 50 }
   });

sm.doTransition(TRANSITION.VAPORIZE) // Promise { sm }
   .then(sm => {
       sm.state; // "GAS"
       sm.data; // { temperature: 200 }
   });
```

## Initialization

`ts-fsm` provide overloaded constructor and methods signature.

```typescript
new StateMachine<STATE, TRANSITION, IDATA>(
    STATE.SOLID, 
    states,
    transitions
);

new StateMachine<STATE, TRANSITION, IDATA>(
    STATE.SOLID, // initial state 
    {
        before: () => {}, // beforeEachState
        states,
        after: [() => {}, () => {}], // afterEachState
    }, {
        before: () => {}, // beforeEachTransition
        transitions,
        after: [() => {}, () => {}], // afterEachTransition
    }, {
        onError: () => {};
        timeout: 1000;
    }
);
```

## Lifecycle Hooks

State machine provide several hooks for track or perform an action when a transition occurs.

As a handler, both a single function and an array of functions can be passed.

As a value, the handler takes `transport`, `from-state`, `to-state`. `this` - an instance of state machine.

`transport` argument - mutable object, shared and passed through each hook handler.

Transition can be canceled from any handler with explicitly return `false` or `Promise { false }`, in this case, then the subsequent handlers are not called, and state machine return to previous state.

Each handler can be limited by time with passing `timeout` setting into constructor.

| Hook | Define | Fired |
|------|--------|-------|
| ```afterEachState``` | constructor: state: after | after any state
| ```afterState``` | state: after | after specific state
| ```beforeEachTransition``` | constructor: transition: before | before any transition
| ```beforeTransition``` | transition: before | before specific transition
|-|-|-|
| ```afterTransition``` | transition: after | after specific transition
| ```afterEachTransition``` | constructor: transition: after | after any transition
| ```beforeState``` | state: before | before specific state
| ```beforeEachState``` | constructor: state: before | before any state

```typescript
const increaseEntropy = ({ transport }: { transport: IObject }) => {
    transport["entropy"] = transport["entropy"] === undefined ? 0 : transport["entropy"] + 1;
};

new StateMachine<STATE, TRANSITION, IDATA>(
    STATE.SOLID, 
    {
        before: increaseEntropy, // accept single function or array of functions
        states,
        after: [ // accept single function or array of functions
            (transport, from, to) => {
                console.log(transport["entropy"]); // 0
            },
            increaseEntropy,
            (transport, from, to) => {
                console.log(transport["entropy"]); // 1
            },
        ]
    },
    transitions 
); 
```

Also additional aruments can be passed to `transitTo` and `doTransition` methods.

```typescript
const handler = (transport, from, to, ...args) => { console.log(args); }

sm.transitTo(STATE.GAS, 1, null, "3"); // [1, null, "3"]
```

## Pending state

`doTransition` and `transitTo` methods set state machine into pending state.

```typescript
sm.isPending; // false

sm.transitTo(STATE.GAS)
  .then(sm => {
      sm.isPending; // false
  });

sm.isPending; // true

sm.transitTo(STATE.LIQUID) // throws: StateMachineError#PENDING_STATE
```

## Hydration \ dehydration

Hydration\dehydration mechanism allows save\recover current state of state machine.

Getter `dehydrated` returns simple plain object-representation of state machine's state.

Method `hydrate` accept object returned by `dehydrated` and recover state.

```typescript
const currentState = sm.hydrated;
console.log(currentState);
/* {
    state: "GAS",
    data: { temperature: 200 },
    transport: { entropy: 2 }
} */

saveToAnywhere(currentState);


// ***********
// later
const savedState = getFromAnywhere();
sm.hydrate(savedState);
```

## Custom error handling

By default `ts-fsm` throw errors, but this behaviour mey be changed with `onError` handler function implementation.

Each time, then `ts-fsm` throw an error firstly will fire `onError` handler with error passed with first argument.

`onError` may throw it's custom error, otherwise `ts-fsm`'s error will thrown.

Anyway state machine throw error.

```typescript
new StateMachine<STATE, TRANSITION, IDATA>(
    STATE.SOLID, 
    states,
    transitions,
    {
        onError(error) {
            someAwesomeLogger(error);
            makeSomeAction();
            throw CustomError("Custom Error!");
        }
    }
); 
```
