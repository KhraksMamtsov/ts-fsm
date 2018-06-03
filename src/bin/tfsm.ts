#!/usr/bin/env node

/**
 * Module dependencies.
 */

import * as program from "commander";
import chalk from "chalk";
import { resolve } from "path";
import { writeFile } from "fs";
// @ts-ignore
import * as figlet from "figlet";
import StateMachine from "../StateMachine";
import visualize from "./visualize";

console.log(chalk.greenBright(figlet.textSync("TFSM")));

const str2array = (val: string) => val.split(",");

enum OUTPUT {
	MD = "md",
	CONSOLE = "console",
}

program
	.command("visualize <state-machine-filepaths>")
	.alias("v")
	.description("visualize state machine class")
	.option(
		"-f, --formats [formats]",
		`output formats [${OUTPUT.CONSOLE}, ${OUTPUT.MD}(marmeid)]`,
		str2array,
		[OUTPUT.CONSOLE]
	)
	.action(function(filepaths) {
		const parsedFilepaths = str2array(filepaths);
		parsedFilepaths.forEach(async filepath => {
			const resolvedFilepath = resolve(__dirname, filepath);

			const { default: TestSM } = (await import(resolvedFilepath)) as {
				default: StateMachine<any, any, any>;
			};

			console.log(visualize(TestSM));

			const mermaidGraph = visualize(TestSM);

			// tslint:disable-next-line:no-empty
			writeFile(resolvedFilepath.replace(/\.ts$/, ".md"), mermaidGraph, "utf8", () => {});
		});
	});

program.version("0.0.1").parse(process.argv);
