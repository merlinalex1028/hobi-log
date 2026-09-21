import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import ProductFilterBar from './ProductFilterBar.vue'
import type { ProductFilterState } from '@/types/forms'

function baseFilters(): ProductFilterState {
  return {
    page: 1,
    pageSize: 24,
    keyword: '',
    category: '',
    manufacturer: '',
    ipName: '',
    characterName: '',
    status: '',
  }
}

const ElInputStub = defineComponent({
  props: { modelValue: { type: String, default: '' }, placeholder: String },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => () =>
    h('input', {
      value: props.modelValue,
      placeholder: props.placeholder,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    }),
})

const ElButtonStub = defineComponent({
  emits: ['click'],
  setup: (_, { slots, emit }) => () => h('button', { onClick: () => emit('click') }, slots.default?.()),
})

const SlotStub = defineComponent({
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})

const DrawerStub = defineComponent({
  props: { modelValue: Boolean },
  setup: (props, { slots }) => () => (props.modelValue ? h('div', slots.default?.()) : null),
})

const stubs = {
  ElInput: ElInputStub,
  ElButton: ElButtonStub,
  ElSelect: SlotStub,
  ElDrawer: DrawerStub,
  ElForm: SlotStub,
  ElFormItem: SlotStub,
  ElOption: true,
}

function mountBar(modelValue: ProductFilterState = baseFilters()) {
  return mount(ProductFilterBar, { props: { modelValue }, global: { stubs } })
}

describe('ProductFilterBar', () => {
  it('修改关键词时回写 modelValue 并把页码重置为 1', async () => {
    const wrapper = mountBar({ ...baseFilters(), page: 3 })
    await wrapper.find('.product-filter-bar__keyword').setValue('芙宁娜')
    const emitted = wrapper.emitted('update:modelValue')?.[0]?.[0] as ProductFilterState
    expect(emitted.keyword).toBe('芙宁娜')
    expect(emitted.page).toBe(1)
    expect(emitted.pageSize).toBe(24)
  })

  it('关键词变化后 debounce 300ms 才触发一次 search', async () => {
    const wrapper = mountBar()
    await wrapper.setProps({ modelValue: { ...baseFilters(), keyword: 'g' } })
    await wrapper.setProps({ modelValue: { ...baseFilters(), keyword: 'gk' } })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(wrapper.emitted('search')).toBeUndefined()
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('点击重置 emit reset，不触发 search', async () => {
    const wrapper = mountBar({ ...baseFilters(), keyword: 'gk' })
    const resetButton = wrapper.findAll('button').find(button => button.text() === '重置')
    expect(resetButton).toBeTruthy()
    await resetButton?.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('“更多筛选”按钮打开抽屉后才出现 IP / 角色字段', async () => {
    const wrapper = mountBar()
    expect(wrapper.findAll('input')).toHaveLength(2)
    const moreButton = wrapper.findAll('button').find(button => button.text() === '更多筛选')
    await moreButton?.trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(4)
  })
})
