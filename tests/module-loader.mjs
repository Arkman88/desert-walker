import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// File URLs preserve module identity and allow cycles and worker-thread imports.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desert-walker-tests-'))
const compiled = new Map()
process.once('exit', () => fs.rmSync(directory, { recursive: true, force: true }))

export function moduleURL(file) {
  const sourceURL = new URL(file, import.meta.url)
  const cached = compiled.get(sourceURL.href)
  if (cached) return cached
  const outputURL = pathToFileURL(path.join(directory, `${compiled.size}.mjs`)).href
  compiled.set(sourceURL.href, outputURL)
  const code = ts.transpileModule(fs.readFileSync(sourceURL, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    transformers: {
      after: [context => {
        const visit = node => {
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            const name = node.moduleSpecifier.text
            let url
            if (name.startsWith('.')) {
              const dependency = new URL(name, sourceURL)
              if (!path.extname(dependency.pathname)) dependency.pathname += '.ts'
              url = moduleURL(dependency.href)
            } else {
              url = import.meta.resolve(name)
            }
            const specifier = ts.factory.createStringLiteral(url)
            return ts.isImportDeclaration(node)
              ? ts.factory.updateImportDeclaration(node, node.modifiers, node.importClause, specifier, node.attributes)
              : ts.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, specifier, node.attributes)
          }
          return ts.visitEachChild(node, visit, context)
        }
        return source => ts.visitNode(source, visit)
      }],
    },
  }).outputText
  fs.writeFileSync(fileURLToPath(outputURL), code)
  return outputURL
}
