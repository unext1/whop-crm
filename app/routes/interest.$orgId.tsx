import { eq } from 'drizzle-orm';
import { Briefcase, CheckCircle, Mail, Phone, Send, User } from 'lucide-react';
import { useState } from 'react';
import { data, Form, useActionData, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { emailsTable, organizationTable, peopleEmailsTable, peopleTable } from '~/db/schema';
import { logPersonActivity } from '~/utils/activity.server';
import type { Route } from './+types/interest.$orgId';

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { orgId } = params as { orgId: string };

  // Validate organization exists
  const organization = await db
    .select({
      id: organizationTable.id,
      name: organizationTable.name,
    })
    .from(organizationTable)
    .where(eq(organizationTable.id, orgId))
    .limit(1);

  if (organization.length === 0) {
    throw data('Organization not found', { status: 404 });
  }

  return {
    organization: organization[0],
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { orgId } = params as { orgId: string };
  const formData = await request.formData();

  const name = formData.get('name')?.toString();
  const email = formData.get('email')?.toString();
  const phone = formData.get('phone')?.toString();
  const company = formData.get('company')?.toString();
  const jobTitle = formData.get('jobTitle')?.toString();
  const message = formData.get('message')?.toString();
  const linkedin = formData.get('linkedin')?.toString();
  const website = formData.get('website')?.toString();

  // Validate required fields
  if (!name || name.trim().length === 0) {
    return data({ error: 'Name is required', field: 'name' }, { status: 400 });
  }

  if (!email || email.trim().length === 0) {
    return data({ error: 'Email is required', field: 'email' }, { status: 400 });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return data({ error: 'Please enter a valid email address', field: 'email' }, { status: 400 });
  }

  try {
    // Create the lead in people table
    const [newPerson] = await db
      .insert(peopleTable)
      .values({
        name: name.trim(),
        jobTitle: jobTitle?.trim() || undefined,
        phone: phone?.trim() || undefined,
        linkedin: linkedin?.trim() || undefined,
        website: website?.trim() || undefined,
        notes: message?.trim() || undefined,
        organizationId: orgId,
        // Store company info in description if provided
        description: company?.trim() ? `Company: ${company.trim()}` : undefined,
      })
      .returning();

    // If email is provided, we could create an email record, but for now we'll just store it in notes
    if (email) {
      const insert = await db
        .insert(emailsTable)
        .values({
          email: email,
          organizationId: orgId,
          isPrimary: true,
        })
        .returning();

      await db.insert(peopleEmailsTable).values({
        personId: newPerson.id,
        emailId: insert[0].id,
      });
    }

    // Log activity for lead creation
    await logPersonActivity({
      personId: newPerson.id,
      userId: null, // Public form submission - no authenticated user
      activityType: 'created',
      description: 'Lead submitted via interest form',
    });

    return data({
      success: true,
      message: "Thank you for your interest! We'll be in touch soon.",
      leadId: newPerson.id,
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    return data(
      {
        error: 'Something went wrong. Please try again.',
        field: 'general',
      },
      { status: 500 },
    );
  }
};

const InterestForm = ({ loaderData }: Route.ComponentProps) => {
  const { organization } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [showSuccess, setShowSuccess] = useState(false);

  // Show success message if we have successful submission
  if (actionData && 'success' in actionData && actionData.success) {
    if (!showSuccess) {
      setShowSuccess(true);
    }
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            {actionData && 'message' in actionData
              ? actionData.message
              : "We've received your information and will be in touch soon."}
          </p>
          <Button onClick={() => setShowSuccess(false)} variant="outline" className="w-full">
            Submit Another Response
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4 container mx-auto">
      <div className="max-w-2xl w-full bg-background rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-8 text-white">
          <h1 className="text-2xl font-bold">Spark Interest</h1>
          <p className="text-muted-foreground">We'd love to hear from you</p>
        </div>
        {/* Form */}
        <div className="p-6">
          <Form method="post" className="space-y-6">
            {/* Required fields notice */}
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <span className="text-red-500">*</span> Required fields
            </div>

            {/* Name and Email Row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-red-500">*</span>
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="name" name="name" placeholder="Your full name" className="pl-10 h-11" required />
                </div>
                {actionData && 'error' in actionData && actionData.field === 'name' && (
                  <p className="text-sm text-red-600">{actionData.error}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-red-500">*</span>
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your.email@example.com"
                    className="pl-10 h-11"
                    required
                  />
                </div>
                {actionData && 'error' in actionData && actionData.field === 'email' && (
                  <p className="text-sm text-red-600">{actionData.error}</p>
                )}
              </div>
            </div>

            {/* Company and Job Title Row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm font-medium">
                  Company
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="company" name="company" placeholder="Your company name" className="pl-10 h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle" className="text-sm font-medium">
                  Job Title
                </Label>
                <Input id="jobTitle" name="jobTitle" placeholder="Your role" className="h-11" />
              </div>
            </div>

            {/* Phone and Website Row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 123-4567" className="pl-10 h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">
                  Website
                </Label>
                <Input id="website" name="website" type="url" placeholder="https://yourwebsite.com" className="h-11" />
              </div>
            </div>

            {/* LinkedIn */}
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="text-sm font-medium">
                LinkedIn Profile
              </Label>
              <Input id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/yourprofile" className="h-11" />
            </div>

            {/* General error */}
            {actionData && 'error' in actionData && actionData.field === 'general' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{actionData.error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </Form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center text-sm text-gray-500">
          This form is powered by {organization.name}
        </div>
      </div>
    </div>
  );
};

export default InterestForm;
