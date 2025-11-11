/* eslint-disable jsx-a11y/no-autofocus */
import { Building2, Calendar, MapPin, Repeat, User, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Form, useSubmit } from 'react-router';

import { cn } from '~/utils';
import { Button } from '../ui/button';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { DateTimePicker24h } from '../ui/calendar-time';
import { ComboboxMultiple } from '../ui/combobox-multiple';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type Company = {
  id: string;
  name: string | null;
};

type Person = {
  id: string;
  name: string | null;
};

interface MeetingDialogProps {
  meetingId?: string;
  defaultCompanyId?: string;
  defaultPersonId?: string;
  defaultStartDate?: Date;
  userId?: string;
  organizationId?: string;
  companies?: Company[];
  people?: Person[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MeetingDialog({
  meetingId,
  defaultCompanyId,
  defaultPersonId,
  defaultStartDate,
  userId,
  organizationId,
  companies = [],
  people = [],
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: MeetingDialogProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const [internalOpen, setInternalOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [duration, setDuration] = useState<number>(60);
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>(defaultPersonId ? [defaultPersonId] : []);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(defaultCompanyId ? [defaultCompanyId] : []);

  // Prepare options for comboboxes
  const peopleOptions = useMemo(
    () =>
      people.map((person) => ({
        id: person.id,
        name: person.name || 'Unnamed Person',
      })),
    [people],
  );

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        name: company.name || 'Unnamed Company',
      })),
    [companies],
  );

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              New Meeting
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-base font-semibold m-0">
              {meetingId ? 'Edit Meeting' : 'New Meeting'}
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Form Content */}
        <div className="overflow-auto max-h-[calc(100vh-180px)]">
          <Form
            method="post"
            id="meeting-form"
            className="space-y-6 p-6"
            onSubmit={(event) => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);

              if (meetingId) {
                formData.set('intent', 'updateMeeting');
                formData.set('meetingId', meetingId);
              } else {
                formData.set('intent', 'createMeeting');
              }

              if (userId) formData.set('ownerId', userId);

              if (startDate) {
                formData.set('startDate', startDate.toISOString());
              }

              formData.set('duration', duration.toString());

              if (recurrenceType !== 'none') {
                formData.set('recurrenceType', recurrenceType);
                if (recurrenceEndDate) {
                  formData.set('recurrenceEndDate', recurrenceEndDate.toISOString());
                }
              }

              // Add selected people
              selectedPeopleIds.forEach((id) => {
                formData.append('peopleIds', id);
              });

              // Add selected companies
              selectedCompanyIds.forEach((id) => {
                formData.append('companyIds', id);
              });

              // Validate: require at least one person or company
              if (selectedPeopleIds.length === 0 && selectedCompanyIds.length === 0) {
                alert('Please select at least one person or company');
                return;
              }

              submit(formData, {
                method: 'post',
                action: organizationId ? `/dashboard/${organizationId}/calendar` : undefined,
                navigate: true,
              });

              // Reset form
              if (textAreaRef.current) textAreaRef.current.value = '';
              if (notesRef.current) notesRef.current.value = '';
              if (inputRef.current) inputRef.current.value = '';
              if (locationRef.current) locationRef.current.value = '';
              setStartDate(defaultStartDate);
              setDuration(60);
              setRecurrenceType('none');
              setRecurrenceEndDate(undefined);
              setSelectedPeopleIds(defaultPersonId ? [defaultPersonId] : []);
              setSelectedCompanyIds(defaultCompanyId ? [defaultCompanyId] : []);

              setOpen(false);
            }}
          >
            {/* Main Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Meeting Title <span className="text-muted-foreground">(required)</span>
                </Label>
                <Input
                  autoFocus
                  required
                  ref={inputRef}
                  name="title"
                  placeholder="Enter meeting title..."
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  ref={textAreaRef}
                  name="description"
                  placeholder="Add meeting description..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Date & Time Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Date & Time</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Start Date & Time</Label>
                  <DateTimePicker24h
                    name="startDate"
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select date and time..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Duration</Label>
                  <Select value={duration.toString()} onValueChange={(v) => setDuration(Number.parseInt(v, 10))}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location
                </Label>
                <Input ref={locationRef} name="location" placeholder="Add location..." className="h-10" />
              </div>
            </div>

            {/* Recurrence Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                Recurrence
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Repeat</Label>
                  <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as typeof recurrenceType)}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurrenceType !== 'none' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'h-10 w-full justify-start text-left font-normal',
                            !recurrenceEndDate && 'text-muted-foreground',
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {recurrenceEndDate ? formatDate(recurrenceEndDate) : <span>Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent mode="single" selected={recurrenceEndDate} onSelect={setRecurrenceEndDate} />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>

            {/* Attendees Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Attendees</h3>
              <div className="space-y-4">
                {people.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      People
                    </Label>
                    <ComboboxMultiple
                      options={peopleOptions}
                      selectedIds={selectedPeopleIds}
                      onSelectionChange={setSelectedPeopleIds}
                      placeholder="Select people..."
                      searchPlaceholder="Search people..."
                      emptyText="No people found."
                      className="w-full"
                    />
                  </div>
                )}
                {companies.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Companies
                    </Label>
                    <ComboboxMultiple
                      options={companyOptions}
                      selectedIds={selectedCompanyIds}
                      onSelectionChange={setSelectedCompanyIds}
                      placeholder="Select companies..."
                      searchPlaceholder="Search companies..."
                      emptyText="No companies found."
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea
                  ref={notesRef}
                  name="notes"
                  placeholder="Add meeting notes..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-end gap-2 border-t border-border px-6 bg-muted/30">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="meeting-form" size="sm" className="h-8 text-xs">
            {meetingId ? 'Update' : 'Create'} Meeting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
