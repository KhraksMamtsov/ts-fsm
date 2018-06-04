module.exports = function() {
	return {
		testFramework: "jest",
		files: ["!src/bin/**/*.ts", "!test/**/*.test.ts", "src/**/*.ts"],
		tests: ["test/**/*.test.ts"],
		env: {
			type: "node"
		}
		// ,debug        : true
	};
};
