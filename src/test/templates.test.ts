import { describe, it, expect } from 'vitest'
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplateById } from '@/lib/templates'
import type { FlowTemplate } from '@/types'

// ─────────────────────────────────────────────────────────────
// TEMPLATES – 基本データ整合性
// ─────────────────────────────────────────────────────────────

describe('TEMPLATES – 基本定義', () => {
  it('テンプレートが10件定義されている', () => {
    expect(TEMPLATES).toHaveLength(10)
  })

  it('各テンプレートに必須フィールドが揃っている', () => {
    const requiredKeys: (keyof FlowTemplate)[] = [
      'id', 'name', 'description', 'emoji', 'color',
      'category', 'categoryLabel',
      'initialMarkdown', 'systemPrompt', 'userPromptSuggestions',
    ]
    for (const t of TEMPLATES) {
      for (const key of requiredKeys) {
        expect(t[key], `template "${t.id}" missing field: ${key}`).toBeTruthy()
      }
    }
  })

  it('id がすべてユニーク', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('各テンプレートに userPromptSuggestions が4件以上ある', () => {
    for (const t of TEMPLATES) {
      expect(
        t.userPromptSuggestions.length,
        `"${t.id}" の userPromptSuggestions が少ない`,
      ).toBeGreaterThanOrEqual(4)
    }
  })

  it('各テンプレートの initialMarkdown に ```flow ブロックが含まれる', () => {
    for (const t of TEMPLATES) {
      expect(t.initialMarkdown, `"${t.id}" に flow ブロックがない`).toContain('```flow')
    }
  })

  it('各テンプレートの systemPrompt が空でない', () => {
    for (const t of TEMPLATES) {
      expect(
        t.systemPrompt.trim().length,
        `"${t.id}" の systemPrompt が空`,
      ).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// TEMPLATES – カテゴリ
// ─────────────────────────────────────────────────────────────

describe('TEMPLATES – カテゴリ', () => {
  it('すべてのカテゴリが有効な値を持つ', () => {
    const validCategories = ['analysis', 'planning', 'process', 'organization']
    for (const t of TEMPLATES) {
      expect(validCategories, `"${t.id}" の category が不正`).toContain(t.category)
    }
  })

  it('analysis カテゴリのテンプレートが3件以上ある', () => {
    expect(TEMPLATES.filter((t) => t.category === 'analysis').length).toBeGreaterThanOrEqual(3)
  })

  it('planning カテゴリのテンプレートが3件以上ある', () => {
    expect(TEMPLATES.filter((t) => t.category === 'planning').length).toBeGreaterThanOrEqual(3)
  })

  it('process カテゴリのテンプレートが2件以上ある', () => {
    expect(TEMPLATES.filter((t) => t.category === 'process').length).toBeGreaterThanOrEqual(2)
  })
})

// ─────────────────────────────────────────────────────────────
// TEMPLATES – 個別テンプレート確認
// ─────────────────────────────────────────────────────────────

describe('TEMPLATES – フィッシュボーンチャート', () => {
  const template = TEMPLATES.find((t) => t.id === 'fishbone')!

  it('fishbone テンプレートが存在する', () => {
    expect(template).toBeDefined()
  })

  it('名前が正しい', () => {
    expect(template.name).toBe('フィッシュボーンチャート')
  })

  it('カテゴリが analysis', () => {
    expect(template.category).toBe('analysis')
  })

  it('初期 Markdown に因果関係ノードが含まれる', () => {
    expect(template.initialMarkdown).toContain('cause_method')
    expect(template.initialMarkdown).toContain('effect')
  })

  it('systemPrompt に「6M」が含まれる', () => {
    expect(template.systemPrompt).toContain('6M')
  })
})

describe('TEMPLATES – マインドマップ', () => {
  const template = TEMPLATES.find((t) => t.id === 'mindmap')!

  it('mindmap テンプレートが存在する', () => expect(template).toBeDefined())
  it('カテゴリが planning', () => expect(template.category).toBe('planning'))
  it('初期 Markdown に [[center]] が含まれる', () => {
    expect(template.initialMarkdown).toContain('[[center]]')
  })
})

describe('TEMPLATES – プロセスフローチャート', () => {
  const template = TEMPLATES.find((t) => t.id === 'flowchart')!

  it('flowchart テンプレートが存在する', () => expect(template).toBeDefined())
  it('カテゴリが process', () => expect(template.category).toBe('process'))
  it('分岐ノード ({id}) が含まれる', () => {
    expect(template.initialMarkdown).toMatch(/\{check_/)
  })
})

describe('TEMPLATES – SWOT分析', () => {
  const template = TEMPLATES.find((t) => t.id === 'swot')!

  it('swot テンプレートが存在する', () => expect(template).toBeDefined())
  it('カテゴリが analysis', () => expect(template.category).toBe('analysis'))
  it('4象限がすべて含まれる', () => {
    expect(template.initialMarkdown).toContain('strength')
    expect(template.initialMarkdown).toContain('weakness')
    expect(template.initialMarkdown).toContain('opportunity')
    expect(template.initialMarkdown).toContain('threat')
  })
})

describe('TEMPLATES – ステートマシン', () => {
  const template = TEMPLATES.find((t) => t.id === 'state-machine')!

  it('state-machine テンプレートが存在する', () => expect(template).toBeDefined())
  it('カテゴリが process', () => expect(template.category).toBe('process'))
  it('イベント付き矢印が含まれる', () => {
    expect(template.initialMarkdown).toMatch(/->.*:.*\(/)
  })
})

describe('TEMPLATES – リスク分析フロー', () => {
  const template = TEMPLATES.find((t) => t.id === 'risk-analysis')!

  it('risk-analysis テンプレートが存在する', () => expect(template).toBeDefined())
  it('カテゴリが analysis', () => expect(template.category).toBe('analysis'))
  it('評価分岐ノードが含まれる', () => {
    expect(template.initialMarkdown).toContain('eval_tech')
  })
})

// ─────────────────────────────────────────────────────────────
// getTemplateById
// ─────────────────────────────────────────────────────────────

describe('getTemplateById', () => {
  it('存在する id でテンプレートを取得できる', () => {
    expect(getTemplateById('fishbone')).toBeDefined()
    expect(getTemplateById('fishbone')!.id).toBe('fishbone')
  })

  it('存在しない id では undefined を返す', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined()
  })

  it('すべての id でテンプレートを取得できる', () => {
    for (const t of TEMPLATES) {
      expect(getTemplateById(t.id)).toBeDefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// TEMPLATE_CATEGORIES
// ─────────────────────────────────────────────────────────────

describe('TEMPLATE_CATEGORIES', () => {
  it('"all" カテゴリが最初に定義されている', () => {
    expect(TEMPLATE_CATEGORIES[0].id).toBe('all')
  })

  it('5つのカテゴリが定義されている（all + 4種）', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(5)
  })

  it('各カテゴリに id と label がある', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.label).toBeTruthy()
    }
  })
})
