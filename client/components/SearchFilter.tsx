import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { ui } from "@/lib/ui-classes";

export function SearchFilter({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={ui.study.filter}>
      <span className={ui.field.label}>{label}</span>
      <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={ui.filters.trigger}
            aria-label={label}
          >
            <span className={ui.filters.label}>
              {options.find((option) => option.value === value)?.label || label}
            </span>
            <ChevronsUpDown size={16} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={ui.filters.popup}
            align="start"
            sideOffset={6}
            collisionPadding={16}
          >
            <Command loop label={label}>
              <Command.Input
                className={ui.filters.input}
                placeholder={`${label} 검색…`}
                aria-label={`${label} 검색`}
              />
              <Command.List className={ui.filters.list}>
                <Command.Empty className={ui.filters.empty}>
                  일치하는 단원이 없습니다.
                </Command.Empty>
                {options.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={option.value || "__all__"}
                    keywords={[option.label]}
                    className={ui.filters.item}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className={ui.filters.label}>{option.label}</span>
                    {value === option.value && <Check size={16} />}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
