import type { UnoGenerator } from '@unocss/core'
import type { CssNode, List, ListItem } from 'css-tree'
import type MagicString from 'magic-string'
import type { TransformerDirectivesContext, TransformerDirectivesOptions } from './types'
import { toArray } from '@unocss/core'
import { hasThemeFn as hasThemeFunction } from '@unocss/rule-utils'
import { parse, walk } from 'css-tree'
import { handleApply } from './apply'
import { handleFunction } from './functions'
import { handleScreen } from './screen'

export async function transformDirectives(
  code: MagicString,
  uno: UnoGenerator,
  options: TransformerDirectivesOptions,
  filename?: string,
  originalCode?: string,
  offset?: number,
) {
  let { applyVariable } = options
  const varStyle = options.varStyle
  if (applyVariable === undefined) {
    if (varStyle !== undefined)
      applyVariable = varStyle ? [`${varStyle}apply`] : []
    applyVariable = ['--at-apply', '--uno-apply', '--uno']
  }
  applyVariable = toArray(applyVariable || [])

  const parseCode = originalCode || code.original
  const hasApply = parseCode.includes('@apply') || applyVariable.some(s => parseCode.includes(s))
  const hasScreen = parseCode.includes('@screen')
  const hasThemeFn = hasThemeFunction(parseCode)

  if (!hasApply && !hasThemeFn && !hasScreen)
    return

  const ast = parse(parseCode, {
    parseCustomProperty: true,
    parseAtrulePrelude: false,
    positions: true,
    filename,
    offset,
  })

  if (ast.type !== 'StyleSheet')
    return

  const stack: Promise<void>[] = []

  const ctx: TransformerDirectivesContext = {
    options,
    applyVariable,
    uno,
    code,
    filename,
    offset,
  }

  const processNode = async (node: CssNode, _item: ListItem<CssNode>, _list: List<CssNode>) => {
    if (hasScreen && node.type === 'Atrule')
      handleScreen(ctx, node)

    if (node.type === 'Function')
      handleFunction(ctx, node)

    if (hasApply && node.type === 'Rule')
      await handleApply(ctx, node)
  }

  walk(ast, (...args) => stack.push(processNode(...args)))

  await Promise.all(stack)
}
