[![Build Status](https://travis-ci.org/KhraksMamtsov/tfsm.svg?branch=master)](https://travis-ci.org/KhraksMamtsov/tfsm)
[![Coverage Status](https://coveralls.io/repos/github/KhraksMamtsov/tfsm/badge.svg?branch=master)](https://coveralls.io/github/KhraksMamtsov/tfsm?branch=master)

# Finit state machine writen in typescript

Advanced

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

const sm = new StateMachine<STATE, TRANSITION, IDATA>(STATE.SOLID, { states }, { transitions });

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
       sm.data; // { temperature: 50 }
   });
```

## Lifecycle Hooks

State machine provide several hooks for track or perform an action when a transition occurs.

As a handler, both a single function and an array of functions can be passed.

As a value, the handler takes `transport`, `from-state`, `to-state`. `this` - an instance of state machine.

Transition can be canceled from any handler with explicitly return `false` or `Promise { false }`, in this case, then the subsequent handlers are not called, and state machine return to previous state.

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
new StateMachine<STATE, TRANSITION, IDATA>(
    STATE.SOLID, {
    before: function (transport, from, to) => {
    } 
    states 
    }, { 
    transitions 
}); 
```

## Pending state

`doTransition` and `transitTo` methods set state machin into pending state

```typescript
sm.isPending; // false

sm.transitTo(STATE.GAS)
  .then(sm => {
      sm.isPending; // false
  });

sm.isPending; // true

sm.transitTo(STATE.LIQUID) // throws: StateMachineError#PENDING_STATE
```
