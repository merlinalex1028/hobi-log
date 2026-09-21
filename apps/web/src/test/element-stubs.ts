import { defineComponent, h } from 'vue'

export const ElButtonStub = defineComponent({
  props: { disabled: Boolean, type: String, link: Boolean, loading: Boolean, size: String },
  emits: ['click'],
  setup:
    (props, { slots, emit }) =>
    () =>
      h('button', { disabled: props.disabled, onClick: (event: Event) => emit('click', event) }, slots.default?.()),
})

export const ElInputStub = defineComponent({
  props: { modelValue: [String, Number], placeholder: String, disabled: Boolean, type: String },
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        value: props.modelValue === undefined || props.modelValue === null ? '' : String(props.modelValue),
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})

export const ElInputNumberStub = defineComponent({
  props: { modelValue: [String, Number], placeholder: String, disabled: Boolean, min: Number, max: Number },
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        class: 'el-input-number',
        value: props.modelValue === undefined || props.modelValue === null ? '' : String(props.modelValue),
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', Number((event.target as HTMLInputElement).value)),
      }),
})

export const ElSelectStub = defineComponent({
  props: { modelValue: [String, Number, Array], placeholder: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h(
        'select',
        {
          value: String(props.modelValue ?? ''),
          disabled: props.disabled,
          onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
        },
        slots.default?.(),
      ),
})

export const ElOptionStub = defineComponent({
  props: { value: [String, Number], label: String },
  setup: props => () => h('option', { value: String(props.value) }, props.label ?? String(props.value)),
})

export const ElSwitchStub = defineComponent({
  props: { modelValue: Boolean, disabled: Boolean, activeText: String },
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('button', {
        class: 'el-switch',
        disabled: props.disabled,
        onClick: () => emit('update:modelValue', !props.modelValue),
      }),
})

export const ElDatePickerStub = defineComponent({
  props: { modelValue: String, placeholder: String, disabled: Boolean, type: String, valueFormat: String },
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        class: 'el-date-picker',
        value: props.modelValue ?? '',
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})

export const SlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})

export const NamedSlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.extra?.(), slots.footer?.()]),
})

export const ElAlertStub = defineComponent({
  props: { title: String, type: String },
  setup:
    (props, { slots }) =>
    () =>
      h('div', { class: 'el-alert' }, [props.title, slots.default?.()]),
})

export const ElProgressStub = defineComponent({
  props: { percentage: Number, showText: Boolean },
  setup: props => () => h('div', { class: 'el-progress', 'data-percentage': String(props.percentage ?? 0) }),
})

export const ElTagStub = defineComponent({
  props: { type: String, size: String, label: String },
  setup:
    (props, { slots }) =>
    () =>
      h('span', { class: 'el-tag' }, props.label ?? slots.default?.()),
})

export const ElCheckboxStub = defineComponent({
  props: { modelValue: Boolean, disabled: Boolean },
  emits: ['update:modelValue'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h('label', [
        h('input', {
          type: 'checkbox',
          checked: props.modelValue,
          disabled: props.disabled,
          onChange: () => emit('update:modelValue', !props.modelValue),
        }),
        slots.default?.(),
      ]),
})

export const ElEmptyStub = defineComponent({
  props: { description: String },
  setup:
    (props, { slots }) =>
    () =>
      h('div', { class: 'el-empty' }, [slots.default?.(), slots.description?.() ?? props.description]),
})

export const ElDrawerStub = defineComponent({
  props: { modelValue: Boolean, title: String, size: String },
  emits: ['update:modelValue'],
  setup:
    (props, { slots }) =>
    () =>
      props.modelValue ? h('div', { class: 'el-drawer' }, [props.title, slots.default?.(), slots.footer?.()]) : null,
})

export const ElResultStub = defineComponent({
  props: { title: String, subTitle: String, icon: String },
  setup:
    (props, { slots }) =>
    () =>
      h('div', { class: 'el-result' }, [props.title, props.subTitle, slots.default?.(), slots.extra?.(), slots.footer?.()]),
})

export const elementStubs = {
  ElButton: ElButtonStub,
  ElInput: ElInputStub,
  ElInputNumber: ElInputNumberStub,
  ElSelect: ElSelectStub,
  ElOption: ElOptionStub,
  ElSwitch: ElSwitchStub,
  ElDatePicker: ElDatePickerStub,
  ElForm: SlotStub,
  ElFormItem: SlotStub,
  ElAlert: ElAlertStub,
  ElProgress: ElProgressStub,
  ElTag: ElTagStub,
  ElCheckbox: ElCheckboxStub,
  ElDrawer: ElDrawerStub,
  ElDivider: SlotStub,
  ElDescriptions: SlotStub,
  ElDescriptionsItem: SlotStub,
  ElSkeleton: SlotStub,
  ElEmpty: ElEmptyStub,
  ElResult: ElResultStub,
  ElTimeline: SlotStub,
  ElTimelineItem: SlotStub,
  ElPagination: SlotStub,
  ElDialog: ElDrawerStub,
  ElRadioGroup: SlotStub,
  ElRadioButton: SlotStub,
}
