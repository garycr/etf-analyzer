import ts from "typescript";

const childProcessModules = new Set(["child_process", "node:child_process"]);
const childProcessCalls = new Set(["exec", "execFile", "execFileSync", "execSync", "fork", "spawn", "spawnSync"]);

const unwrap = (node) => {
  let expression = node;
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  return expression;
};

export const scanSource = (sourceText, fileName = "source.ts") => {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022, true);
  if (sourceFile.parseDiagnostics.length > 0) throw new Error(`${fileName}: TypeScript parse failed`);

  const forbiddenBindings = new Set(["eval", "Function"]);
  const loaderBindings = new Set(["require"]);
  const globalBindings = new Set(["globalThis"]);
  const findings = [];
  const report = (node, call) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ fileName, line: position.line + 1, column: position.character + 1, call });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && childProcessModules.has(statement.moduleSpecifier.text)) {
      report(statement.moduleSpecifier, `import ${statement.moduleSpecifier.text}`);
    }
  }

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      const initializer = unwrap(node.initializer);
      if (ts.isIdentifier(initializer) && forbiddenBindings.has(initializer.text)) forbiddenBindings.add(node.name.text);
      if (ts.isIdentifier(initializer) && loaderBindings.has(initializer.text)) loaderBindings.add(node.name.text);
      if (ts.isIdentifier(initializer) && globalBindings.has(initializer.text)) globalBindings.add(node.name.text);
      if (ts.isPropertyAccessExpression(initializer) && ts.isIdentifier(initializer.expression)
        && globalBindings.has(initializer.expression.text) && ["eval", "Function"].includes(initializer.name.text)) forbiddenBindings.add(node.name.text);
      if (ts.isElementAccessExpression(initializer) && ts.isIdentifier(initializer.expression)
        && globalBindings.has(initializer.expression.text) && initializer.argumentExpression
        && ts.isStringLiteral(initializer.argumentExpression) && ["eval", "Function"].includes(initializer.argumentExpression.text)) forbiddenBindings.add(node.name.text);
    }
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      if (expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
        const moduleName = ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0])
          ? node.arguments[0].text
          : undefined;
        if (moduleName === undefined || childProcessModules.has(moduleName)) report(node.arguments[0], `import ${moduleName ?? "dynamic"}`);
      }
      if (ts.isIdentifier(expression) && loaderBindings.has(expression.text) && node.arguments[0]) {
        const moduleName = ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0])
          ? node.arguments[0].text
          : undefined;
        if (moduleName === undefined || childProcessModules.has(moduleName)) report(node.arguments[0], `require ${moduleName ?? "dynamic"}`);
      }
      if (ts.isIdentifier(expression) && forbiddenBindings.has(expression.text)) report(expression, expression.text);
      if (ts.isPropertyAccessExpression(expression)) {
        const owner = unwrap(expression.expression);
        if (ts.isIdentifier(owner) && globalBindings.has(owner.text) && ["eval", "Function"].includes(expression.name.text)) report(expression, expression.name.text);
        if (ts.isIdentifier(owner) && forbiddenBindings.has(owner.text) && expression.name.text === "call") report(expression, owner.text);
      }
      if (ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression)
        && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression)) {
        const owner = expression.expression.text;
        const member = expression.argumentExpression.text;
        if (globalBindings.has(owner) && ["eval", "Function"].includes(member)) report(expression, member);
      }
    }
    if (ts.isNewExpression(node)) {
      const expression = unwrap(node.expression);
      if (ts.isIdentifier(expression) && forbiddenBindings.has(expression.text)) report(expression, expression.text);
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
        && globalBindings.has(expression.expression.text) && expression.name.text === "Function") report(expression, "Function");
      if (ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression)
        && globalBindings.has(expression.expression.text) && expression.argumentExpression
        && ts.isStringLiteral(expression.argumentExpression) && expression.argumentExpression.text === "Function") report(expression, "Function");
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
};
