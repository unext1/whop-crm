import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSubmit } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import type { FormFieldConfig } from '~/db/schema/forms';

type FormBuilderProps = {
  companyId: string;
  formId?: string;
  pipelineColumns?: Array<{ id: string; name: string; boardName: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    name?: string;
    description?: string;
    entityType?: 'person' | 'company' | 'both';
    defaultEntityType?: 'person' | 'company';
    allowEntitySelection?: boolean;
    createDeal?: boolean;
    pipelineColumnId?: string;
    successMessage?: string;
    fields?: FormFieldConfig[];
  };
};

const AVAILABLE_FIELDS = {
  person: [
    { value: 'name', label: 'Name', type: 'text', required: true },
    { value: 'email', label: 'Email', type: 'email', required: true },
    { value: 'phone', label: 'Phone', type: 'tel' },
    { value: 'jobTitle', label: 'Job Title', type: 'text' },
    { value: 'description', label: 'Description', type: 'textarea' },
    { value: 'linkedin', label: 'LinkedIn', type: 'url' },
    { value: 'twitter', label: 'Twitter', type: 'url' },
    { value: 'website', label: 'Website', type: 'url' },
    { value: 'address', label: 'Address', type: 'text' },
  ],
  company: [
    { value: 'name', label: 'Company Name', type: 'text', required: true },
    { value: 'email', label: 'Email', type: 'email' },
    { value: 'phone', label: 'Phone', type: 'tel' },
    { value: 'description', label: 'Description', type: 'textarea' },
    { value: 'domain', label: 'Domain', type: 'text' },
    { value: 'website', label: 'Website', type: 'url' },
    { value: 'industry', label: 'Industry', type: 'text' },
    { value: 'address', label: 'Address', type: 'text' },
    { value: 'linkedin', label: 'LinkedIn', type: 'url' },
    { value: 'twitter', label: 'Twitter', type: 'url' },
  ],
};

export const FormBuilder = ({
  companyId,
  formId,
  pipelineColumns = [],
  open,
  onOpenChange,
  initialData,
}: FormBuilderProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [entityType, setEntityType] = useState<'person' | 'company' | 'both'>(initialData?.entityType || 'person');
  const [defaultEntityType, setDefaultEntityType] = useState<'person' | 'company'>(
    initialData?.defaultEntityType || 'person',
  );
  const [allowEntitySelection, setAllowEntitySelection] = useState(initialData?.allowEntitySelection || false);
  const [createDeal, setCreateDeal] = useState(initialData?.createDeal || false);
  const [pipelineColumnId, setPipelineColumnId] = useState<string>(initialData?.pipelineColumnId || '');
  const [successMessage, setSuccessMessage] = useState(
    initialData?.successMessage || "Thank you for your submission! We'll be in touch soon.",
  );
  const [fields, setFields] = useState<FormFieldConfig[]>(initialData?.fields || []);
  const [availableFields, setAvailableFields] = useState(AVAILABLE_FIELDS.person);

  // Update available fields when entity type changes
  useEffect(() => {
    if (entityType === 'person') {
      setAvailableFields(AVAILABLE_FIELDS.person);
    } else if (entityType === 'company') {
      setAvailableFields(AVAILABLE_FIELDS.company);
    } else {
      // For 'both', show person fields by default
      setAvailableFields(AVAILABLE_FIELDS.person);
    }
  }, [entityType]);

  const [isFormValid, setIsFormValid] = useState(false);

  // Update validation state
  useEffect(() => {
    const valid = name.trim().length > 0 && fields.length > 0;
    setIsFormValid(valid);
  }, [name, fields]);

  const addField = (fieldValue: string) => {
    const fieldDef = availableFields.find((f) => f.value === fieldValue);
    if (!fieldDef) return;

    const newField: FormFieldConfig = {
      id: crypto.randomUUID(),
      name: fieldDef.value,
      label: fieldDef.label,
      type: fieldDef.type as 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select',
      required: fieldDef.required || false,
      placeholder: `Enter ${fieldDef.label.toLowerCase()}`,
      entityField: fieldDef.value,
    };

    setFields([...fields, newField]);
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<FormFieldConfig>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const submit = useSubmit();

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('intent', formId ? 'updateForm' : 'createForm');
    if (formId) formData.append('formId', formId);
    formData.append('name', name);
    formData.append('description', description);
    formData.append('entityType', entityType);
    if (entityType === 'both') {
      formData.append('defaultEntityType', defaultEntityType);
      formData.append('allowEntitySelection', allowEntitySelection.toString());
    }
    formData.append('createDeal', createDeal.toString());
    if (createDeal && pipelineColumnId) {
      formData.append('pipelineColumnId', pipelineColumnId);
    }
    formData.append('successMessage', successMessage);
    formData.append('fields', JSON.stringify(fields));
    return formData;
  };

  const handleSubmit = () => {
    if (!isFormValid) {
      console.log('[FormBuilder] Form is not valid, cannot submit');
      return;
    }
    const formData = buildFormData();
    console.log('[FormBuilder] Submitting form with data:', {
      intent: formData.get('intent'),
      name: formData.get('name'),
      fields: formData.get('fields'),
      action: `/dashboard/${companyId}/forms`,
    });
    // Close dialog immediately for better UX
    onOpenChange(false);
    submit(formData, { method: 'post', action: `/dashboard/${companyId}/forms`, navigate: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[800px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s flex flex-col max-h-[90vh]"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold m-0">
                {formId ? 'Edit Form' : 'Create New Form'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground m-0 p-0">
                {formId
                  ? 'Update your form configuration'
                  : 'Build a custom form to collect leads and add them to your CRM'}
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Form Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contact Form"
                  required
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this form"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={entityType}
                  onValueChange={(value: 'person' | 'company' | 'both') => setEntityType(value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="both">Both (Person or Company)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {entityType === 'both' && (
                <>
                  <div className="space-y-2">
                    <Label>Default Entity Type</Label>
                    <Select
                      value={defaultEntityType}
                      onValueChange={(value: 'person' | 'company') => setDefaultEntityType(value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="person">Person</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowEntitySelection"
                      checked={allowEntitySelection}
                      onCheckedChange={setAllowEntitySelection}
                    />
                    <Label htmlFor="allowEntitySelection" className="cursor-pointer">
                      Allow users to choose between Person/Company
                    </Label>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Form Fields</Label>
                  <Select onValueChange={addField}>
                    <SelectTrigger className="h-8 w-[200px] text-xs">
                      <SelectValue placeholder="Add field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields
                        .filter((f) => !fields.some((field) => field.entityField === f.value))
                        .map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-2 p-3 border border-border rounded-lg bg-muted/30"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="Field label"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            placeholder="Placeholder text"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(checked) => updateField(field.id, { required: checked as boolean })}
                          />
                          <Label className="text-xs">Required</Label>
                          <Badge variant="outline" className="h-5 text-xs">
                            {field.type}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeField(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No fields added yet. Add a field to get started.
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="createDeal" checked={createDeal} onCheckedChange={setCreateDeal} />
                  <Label htmlFor="createDeal" className="cursor-pointer">
                    Create deal in pipeline when form is submitted
                  </Label>
                </div>

                {createDeal && (
                  <PipelineColumnSelector
                    columns={pipelineColumns}
                    value={pipelineColumnId}
                    onChange={setPipelineColumnId}
                  />
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="successMessage">Success Message</Label>
                  <Textarea
                    id="successMessage"
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <div className="flex justify-end gap-2 p-4 border-t w-full">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!isFormValid}>
              {formId ? 'Update Form' : 'Create Form'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PipelineColumnSelector = ({
  columns,
  value,
  onChange,
}: {
  columns: Array<{ id: string; name: string; boardName: string }>;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="space-y-2">
      <Label>Pipeline Stage</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select pipeline stage..." />
        </SelectTrigger>
        <SelectContent>
          {columns.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No pipeline stages found</div>
          ) : (
            columns.map((column) => (
              <SelectItem key={column.id} value={column.id}>
                {column.boardName} - {column.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
