import { Select as AntSelect } from "antd"
import type { SelectProps } from "antd"

// Keep saved labels available while offering only eligible options in the popup.
function SelectableSelect(props: SelectProps) {
  const { options, labelRender, ...rest } = props
  const fields = props.fieldNames
  const optionsKey = fields?.options ?? "options"
  const valueKey = fields?.value ?? "value"
  const labelKey = fields?.label ?? "label"
  const labels = new Map<unknown, unknown>()
  const eligible = (rows: NonNullable<SelectProps["options"]>): typeof rows =>
    rows.flatMap((row) => {
      if (Array.isArray(row[optionsKey])) {
        const children = eligible(row[optionsKey])
        return row.disabled || !children.length ? [] : [{ ...row, [optionsKey]: children }]
      }
      labels.set(row[valueKey], row[labelKey])
      return row.disabled ? [] : [row]
    })
  const visibleOptions = options ? eligible(options) : options

  return <AntSelect {...rest} options={visibleOptions} labelRender={labelRender ?? ((item) =>
    item.label ?? (labels.get(item.value) as React.ReactNode) ?? item.value
  )} />
}

export default SelectableSelect as typeof AntSelect
