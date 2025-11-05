// const TeamPurposeMockup = ({ selectedPurpose }: { selectedPurpose?: string }) => (
//   <div className="w-full max-w-2xl space-y-4">
//     {/* Header */}
//     <div className="flex h-14 items-center justify-between border border-border/40 bg-muted/10 px-4 rounded-lg">
//       <div className="flex items-center gap-2">
//         <Check className="h-5 w-5 text-primary" />
//         <span className="text-sm font-semibold">Projects Created</span>
//       </div>
//       <div className="h-6 w-6 rounded-full bg-muted/30" />
//     </div>

//     {/* Project Cards */}
//     <div className="space-y-3">
//       {selectedPurpose === 'sales' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-blue-500/20 flex items-center justify-center">
//                 <span className="text-sm">💰</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Sales Pipeline</div>
//                 <div className="text-xs text-muted-foreground">Lead → In Progress → Won → Lost</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-green-500/20 flex items-center justify-center">
//                 <span className="text-sm">🎉</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Customer Onboarding</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {selectedPurpose === 'customer-success' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-orange-500/20 flex items-center justify-center">
//                 <span className="text-sm">🤝</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Customer Retention</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-purple-500/20 flex items-center justify-center">
//                 <span className="text-sm">📊</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Success Metrics</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {selectedPurpose === 'fundraising' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-red-500/20 flex items-center justify-center">
//                 <span className="text-sm">🎯</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Donor Pipeline</div>
//                 <div className="text-xs text-muted-foreground">Lead → In Progress → Won → Lost</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-yellow-500/20 flex items-center justify-center">
//                 <span className="text-sm">📈</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Campaign Tracking</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {selectedPurpose === 'investing' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-green-500/20 flex items-center justify-center">
//                 <span className="text-sm">💼</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Deal Flow</div>
//                 <div className="text-xs text-muted-foreground">Lead → In Progress → Won → Lost</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-blue-500/20 flex items-center justify-center">
//                 <span className="text-sm">🔍</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Due Diligence</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {selectedPurpose === 'recruiting' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-indigo-500/20 flex items-center justify-center">
//                 <span className="text-sm">👥</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Candidate Pipeline</div>
//                 <div className="text-xs text-muted-foreground">Lead → In Progress → Won → Lost</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-teal-500/20 flex items-center justify-center">
//                 <span className="text-sm">💬</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Interview Process</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {selectedPurpose === 'other' && (
//         <>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-pink-500/20 flex items-center justify-center">
//                 <span className="text-sm">⚡</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Quick Wins</div>
//                 <div className="text-xs text-muted-foreground">Blank project for custom setup</div>
//               </div>
//             </div>
//           </div>
//           <div className="p-4 bg-muted/10 border border-border/30 rounded-lg">
//             <div className="flex items-center gap-3 mb-2">
//               <div className="h-8 w-8 rounded bg-cyan-500/20 flex items-center justify-center">
//                 <span className="text-sm">💡</span>
//               </div>
//               <div>
//                 <div className="text-sm font-medium">Ideas & Innovation</div>
//                 <div className="text-xs text-muted-foreground">Blank project for creative freedom</div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//       {!selectedPurpose && (
//         <div className="p-8 text-center text-muted-foreground">
//           <div className="text-lg mb-2">🎯</div>
//           <div className="text-sm">Select a team purpose to see your projects</div>
//         </div>
//       )}
//     </div>
//   </div>
// );

// {
//   step === 3 && (
//     <div className="flex flex-col gap-12">
//       <div className="flex flex-col gap-4">
//         <div className="flex flex-col gap-1">
//           <h1 className="text-3xl font-bold text-foreground">What does your team do?</h1>
//           <p className="text-lg text-muted-foreground">We'll set up some projects tailored to your team's needs</p>
//         </div>
//       </div>

//       <div className="flex flex-col gap-6">
//         <Form method="post" className="flex flex-col gap-6">
//           <input type="hidden" name="intent" value="selectTeamPurpose" />

//           <div className="space-y-3">
//             <div className="grid grid-cols-1 gap-2">
//               {[
//                 {
//                   id: 'sales',
//                   name: 'Sales',
//                   description: 'Lead generation and deal tracking',
//                   icon: '💰',
//                   projects: ['Sales Pipeline', 'Customer Onboarding'],
//                 },
//                 {
//                   id: 'customer-success',
//                   name: 'Customer Success',
//                   description: 'Retention, expansion, and customer satisfaction',
//                   icon: '🤝',
//                   projects: ['Customer Retention', 'Success Metrics'],
//                 },
//                 {
//                   id: 'fundraising',
//                   name: 'Fundraising',
//                   description: 'Donor outreach and campaign management',
//                   icon: '🎯',
//                   projects: ['Donor Pipeline', 'Campaign Tracking'],
//                 },
//                 {
//                   id: 'investing',
//                   name: 'Investing',
//                   description: 'Deal sourcing and investment tracking',
//                   icon: '📊',
//                   projects: ['Deal Flow', 'Due Diligence'],
//                 },
//                 {
//                   id: 'recruiting',
//                   name: 'Recruiting',
//                   description: 'Talent acquisition and hiring process',
//                   icon: '👥',
//                   projects: ['Candidate Pipeline', 'Interview Process'],
//                 },
//                 {
//                   id: 'other',
//                   name: 'Other',
//                   description: 'Custom workflows and creative projects',
//                   icon: '✨',
//                   projects: ['Quick Wins', 'Ideas & Innovation'],
//                 },
//               ].map((purpose) => (
//                 <div
//                   key={purpose.id}
//                   className={`cursor-pointer rounded-lg border p-4 transition-all ${
//                     selectedTeamPurpose === purpose.id
//                       ? 'border-primary bg-primary/5'
//                       : 'border-border/50 hover:border-border'
//                   }`}
//                   onClick={() => setSelectedTeamPurpose(purpose.id)}
//                 >
//                   <div className="flex items-start justify-between">
//                     <div className="flex items-start gap-4">
//                       <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center text-lg">
//                         {purpose.icon}
//                       </div>
//                       <div className="flex-1">
//                         <div className="flex items-center gap-2 mb-1">
//                           <div className="text-sm font-medium">{purpose.name}</div>
//                           {selectedTeamPurpose === purpose.id && (
//                             <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
//                               Selected
//                             </Badge>
//                           )}
//                         </div>
//                         <div className="text-xs text-muted-foreground mb-2">{purpose.description}</div>
//                         <div className="flex flex-wrap gap-1">
//                           {purpose.projects.map((project) => (
//                             <Badge key={project} variant="outline" className="text-xs">
//                               {project}
//                             </Badge>
//                           ))}
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
//             <p className="text-sm text-destructive">{actionData.error}</p>
//           )}

//           <Button
//             type="submit"
//             disabled={isSubmitting || !selectedTeamPurpose}
//             className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
//           >
//             {isSubmitting ? 'Setting up projects...' : 'Create my projects'}
//           </Button>
//         </Form>
//       </div>
//     </div>
//   );
// }
