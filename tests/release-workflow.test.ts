import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../.github/workflows/release.yml', import.meta.url),
)
const workflow = readFileSync(workflowPath, 'utf8')

describe('release workflow', () => {
  it('prevents Electron Builder from publishing tagged builds implicitly', () => {
    const packageCommands = workflow.match(
      /command: npx electron-builder[^\n]+/g,
    )

    expect(packageCommands).toHaveLength(3)
    expect(packageCommands?.every((command) => (
      command.includes('--publish never')
    ))).toBe(true)
  })

  it('creates a draft release for manual review', () => {
    expect(workflow).toContain('--draft')
  })

  it('targets the repository explicitly without requiring a checkout', () => {
    expect(workflow).toContain('--repo "${GITHUB_REPOSITORY}"')
  })
})
