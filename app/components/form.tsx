import type { FieldMetadata, SubmissionResult } from '@conform-to/react';
import type { SelectProps } from '@radix-ui/react-select';
import type { ComponentRef, ReactNode } from 'react';
import type { FormProps } from 'react-router';
import type { z } from 'zod';
import type { InputProps } from './ui/input';
import {
  FormProvider,
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
  useInputControl
} from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { Select } from '@radix-ui/react-select';
import { useRef } from 'react';
import { Form as RRForm, useActionData } from 'react-router';

import { AuthenticityTokenInput } from 'remix-utils/csrf/react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';

interface FormWrapperProps {
  inputId: string;
  field?: FieldMetadata<string | boolean | undefined>;
  label?: string;
  children: ReactNode;
}

export const FormInputWrapper = ({ children, field, label, inputId }: FormWrapperProps) => {
  const errorFirstMessage = field?.errors && field?.errors[0];

  return (
    <>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}

      {children}

      {errorFirstMessage ? (
        <label htmlFor={inputId} className="text-red-500 text-sm">
          {errorFirstMessage}
        </label>
      ) : null}
    </>
  );
};

type CustomFormProps<T extends z.ZodSchema> = {
  as?: typeof RRForm;
  schema: T;
  render: ({ fields }: { fields: ReturnType<typeof useForm<z.infer<T>>>[1] }) => ReactNode;
  children?: never;
  handleSave?: (open: boolean) => void;
} & FormProps;

export const CustomForm = <T extends z.Schema>({
  schema,
  as,
  method = 'post',
  render,
  handleSave,
  ...props
}: CustomFormProps<T>) => {
  const lastResult = useActionData<SubmissionResult<string[]> | undefined>();
  const [form, fields] = useForm<z.infer<T>>({
    lastResult,
    onSubmit: () => handleSave?.(false),
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: 'onBlur'
  });
  const Form = as || RRForm;

  return (
    <FormProvider context={form.context}>
      <Form method={method} {...getFormProps(form)} {...props}>
        <AuthenticityTokenInput />
        {render({ fields })}
      </Form>
    </FormProvider>
  );
};

type InputType =
  | 'hidden'
  | 'text'
  | 'email'
  | 'number'
  | 'color'
  | 'url'
  | 'tel'
  | 'file'
  | 'search'
  | 'password'
  | 'datetime-local'
  | 'date'
  | 'range'
  | 'week'
  | 'month'
  | 'time';

type FormInputLabelProps = {
  field: FieldMetadata<string>;
  label?: string;
  type?: InputType;
  defaultValue?: string;
} & Omit<InputProps, 'type'>;

export const CustomInput = ({ field, label, type = 'text', defaultValue, ...props }: FormInputLabelProps) => {
  const { key, ...inputProps } = getInputProps(field, { type });

  return (
    <FormInputWrapper inputId={field.id} field={field} label={label}>
      <Input {...inputProps} {...props} defaultValue={defaultValue} />
    </FormInputWrapper>
  );
};

type FormTextareaProps = {
  field: FieldMetadata<string>;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const CustomTextarea = ({ field, label, placeholder, ...props }: FormTextareaProps) => {
  const { key, ...textareaProps } = getTextareaProps(field);

  return (
    <FormInputWrapper inputId={field.id} field={field} label={label}>
      <Textarea {...textareaProps} {...props} placeholder={placeholder} />
    </FormInputWrapper>
  );
};

type FormSelectProps = Omit<SelectProps, 'defaultValue'> & {
  label?: string;
  placeholder?: string;
  field: FieldMetadata<string>;
  defaultValue?: string | number | readonly string[] | undefined;
  options: { value: string; label: string }[];
};

export const FormSelect = ({ field, label, options, placeholder, defaultValue, ...props }: FormSelectProps) => {
  const { key, ...selectProps } = getSelectProps(field);
  return (
    <FormInputWrapper inputId={field.id} field={field} label={label}>
      <Select {...selectProps} {...props} defaultValue={defaultValue?.toString()}>
        <SelectTrigger id={field.id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormInputWrapper>
  );
};

interface FormSwitchProps {
  label?: string;
  field: FieldMetadata<string | boolean | undefined>;
  description?: string;
}
export const FormSwitch = ({ field, label, description, ...props }: FormSwitchProps) => {
  const switchRef = useRef<ComponentRef<typeof Switch>>(null);
  const control = useInputControl(field);

  return (
    <FormInputWrapper inputId={field.id} field={field}>
      <div className="flex justify-between items-center">
        {label ? (
          <div>
            <Label className="pb-0 block" htmlFor={field.id}>
              {label}
            </Label>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        ) : null}
        <Switch
          ref={switchRef}
          checked={field.value === 'on'}
          onCheckedChange={(checked) => {
            control.change(checked ? 'on' : '');
          }}
          onBlur={control.blur}
          {...props}
        />
        <input
          name={field.name}
          defaultValue={field.initialValue}
          className="sr-only"
          tabIndex={-1}
          onFocus={() => {
            switchRef.current?.focus();
          }}
        />
      </div>
    </FormInputWrapper>
  );
};

interface FormRadioProps {
  label: string;
  field: FieldMetadata<string>;
  options: { value: string; label: string }[];
}
export const FormRadio = ({ field, label, options, ...props }: FormRadioProps) => {
  const radioGroupRef = useRef<ComponentRef<typeof RadioGroup>>(null);
  const control = useInputControl(field);

  return (
    <FormInputWrapper inputId={field.id} field={field} label={label}>
      <RadioGroup
        ref={radioGroupRef}
        value={control.value}
        onValueChange={control.change}
        onBlur={control.blur}
        className="px-2"
        {...props}
      >
        {options.map(({ value, label }) => (
          <div className="flex items-center space-x-2" key={value}>
            <RadioGroupItem id={value} value={value} />
            <label htmlFor={value}>{label}</label>
          </div>
        ))}
      </RadioGroup>
      <input
        name={field.name}
        defaultValue={field.initialValue}
        tabIndex={-1}
        className="sr-only"
        onFocus={() => {
          radioGroupRef.current?.focus();
        }}
      />
    </FormInputWrapper>
  );
};
