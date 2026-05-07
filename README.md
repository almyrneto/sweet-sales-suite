# Sweet Sales Suite

Sweet Sales Suite is a lightweight CRM focused on outbound and inside sales workflows.

The application was built as an MVP-oriented sales platform featuring:

* Kanban pipeline management
* Lead tracking
* AI-powered outreach generation
* Campaign management
* Workspace isolation
* Custom lead fields
* Lead ownership assignment

---

# Live Demo

Production URL:

`https://climbcrm.lovable.app`

Video

`https://drive.google.com/file/d/1lyWO6Wx9RoEllfzoKZBotSbWhm7bVbdZ/view`

---

# Tech Stack

## Frontend

* Lovable
* React
* TypeScript
* TanStack Router
* TailwindCSS
* shadcn/ui
* @dnd-kit
* Sonner

## Backend / Infrastructure

* Supabase

  * PostgreSQL
  * Authentication
  * Row Level Security
  * Edge Functions

## AI

* Supabase Edge Function for AI message generation
* Lovable AI Gateway using `google/gemini-3-flash-preview`

---

# Features

## Authentication & Workspace Isolation

* User authentication with Supabase Auth
* Workspace isolation using `workspace_id`
* Workspace membership system
* Protected routes

---

## Leads CRM

### Lead Management

Users can:

* Create leads
* Edit leads
* Delete leads
* Organize leads by stages
* Assign lead owners
* Add notes and contact information

### Lead Fields

Default fields:

* Name
* Company
* Title
* Email
* Phone
* LinkedIn URL
* Lead Source
* Notes

---

## Custom Fields

The system supports workspace-level custom fields.

Users can dynamically create new lead fields without changing the application code.

Examples:

* Budget
* Company Size
* Current CRM
* Industry
* Last Contact Date

Custom field values are persisted per lead.

---

## Kanban Pipeline

Leads are organized in a drag-and-drop Kanban pipeline.

Current stages:

* Base / Lead Mapeado
* Tentando Contato
* Conexão Iniciada
* Qualificado
* Reunião Agendada
* Desqualificado

Implemented with:

* `@dnd-kit`

---

## Stage Validation Rules

The MVP includes required-field validation before allowing a lead to move into specific stages.

In this version, the rules are implemented in code:

Example:

```ts
const requiredByStage = {
  base_lead_mapeado: ["name", "company", "phone", "title"],
  qualificado: ["name", "company", "email", "title"],
  reuniao_agendada: ["name", "company", "email", "phone"],
};
```

If required information is missing, the lead movement is blocked and the user receives feedback through toast notifications.

Dynamic configuration of required fields per stage is listed as a future improvement.

---

## Campaigns

Users can create outreach campaigns.

Campaigns are associated with leads and used as context for AI-generated outreach messages.

---

## AI Outreach Generation

The application includes AI-powered message generation.

Flow:

1. User selects a campaign
2. User opens a lead
3. User clicks "Generate"
4. Edge Function generates outreach variations
5. Variations are saved in the database

The Edge Function receives the authenticated request, loads the selected lead and campaign from Supabase, combines the campaign context, campaign prompt and lead data, and asks the LLM to return three structured message variations.

Users can:

* Copy generated messages
* Simulate sending messages
* Automatically move the lead stage after sending

Current implementation note: generated messages use the campaign data and standard lead fields. Custom field values are stored per lead, but they are not yet included in the AI prompt.

---

## Dashboard

The dashboard provides:

* Total leads
* Qualified leads
* Meetings scheduled
* Messages generated
* Leads per stage overview

---

# Technical Decisions

## Why Supabase?

Supabase was chosen because it provides:

* Fast backend setup
* Authentication
* PostgreSQL database
* Row Level Security
* Edge Functions
* Realtime-ready architecture

This allowed focusing on product features and UX instead of infrastructure setup.

---

## Why TanStack Router?

TanStack Router provides:

* File-based routing
* Strong TypeScript support
* Route-level organization
* Scalable routing structure

---

## Why dnd-kit?

`@dnd-kit` was chosen for:

* Accessibility
* Performance
* Flexibility
* Smooth drag-and-drop interactions

---

## Data Isolation

All entities are linked to a `workspace_id`.

This guarantees:

* Workspace isolation
* Safer multi-tenant architecture
* Secure data separation

---

## LLM Integration

AI generation is isolated in a Supabase Edge Function instead of being called directly from the frontend.

This keeps the LLM API key out of the browser, allows authenticated access through Supabase, and centralizes prompt construction in one backend entry point.

The function:

* Validates the request authorization
* Loads the lead and campaign from Supabase
* Builds a prompt from campaign context, campaign instructions and lead information
* Calls the Lovable AI Gateway
* Returns three message variations as structured JSON

---

# Database Structure

Main entities:

* profiles
* workspaces
* workspace_members
* leads
* campaigns
* lead_messages
* custom_fields
* lead_custom_field_values

---

# Implemented Scope

## Required Features

* [x] User authentication with Supabase Auth
* [x] Workspace creation
* [x] Workspace-based data isolation using `workspace_id`
* [x] RLS policies for workspace-owned data
* [x] Lead creation, editing and deletion
* [x] Standard lead fields
* [x] Workspace-level custom lead fields
* [x] Optional lead owner assignment
* [x] Kanban pipeline
* [x] Moving leads between stages with drag and drop
* [x] Lead detail view
* [x] Campaign creation with context and AI prompt
* [x] Manual AI message generation
* [x] Message regeneration by generating new variations
* [x] Copy and simulated send actions
* [x] Simulated send moves the lead to `tentando_contato`
* [x] Dashboard with basic workspace metrics
* [ ] Automatic generation by trigger stage

## Partially Implemented

* Required-field validation by stage is implemented in code, not dynamically configurable by users
* AI generation uses standard lead fields, but does not yet include custom field values

## Differentials Included

* [x] Row Level Security policies
* [x] Custom fields
* [x] Lead ownership
* [x] Message history through saved generated messages
* [x] Basic dashboard metrics

## Not Included Yet

* [ ] Dynamic pipeline/stage editing
* [ ] Dynamic required-field configuration
* [ ] Multi-workspace switching UI
* [ ] User invitations
* [ ] Full activity log
* [ ] Advanced filters and search
* [ ] Advanced analytics

---

# Challenges and Trade-offs

The main trade-off was keeping the project focused as an MVP while still covering the core SDR workflow end to end.

Stage validation was implemented as a simple frontend rule set to prove the behavior quickly. A production-ready version would move this configuration to the database so each workspace could define required fields per stage, including custom fields.

Custom fields were modeled separately from leads so workspaces can add attributes without changing the leads table. The current AI prompt uses standard lead fields only; the next step would be joining custom field values in the Edge Function and injecting them into the prompt.

---

# Main Flow

## Lead Creation Flow

1. User creates a lead
2. Lead starts in `base_lead_mapeado`
3. User enriches lead information
4. Lead moves across pipeline stages
5. User generates AI outreach messages
6. Lead moves to contact stage

---

# Future Improvements

Possible future evolutions:

* Dynamic pipeline configuration
* Advanced analytics
* Lead scoring
* Workflow automations
* Email integrations
* Team roles & permissions
* AI stage recommendations
* SLA tracking

---

# Local Setup

## Clone repository

```bash
git clone https://github.com/almyrneto/sweet-sales-suite.git
```

## Install dependencies

```bash
bun install
```

## Environment variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

The AI Edge Function also expects `LOVABLE_API_KEY` to be configured as a Supabase secret.

## Run development server

```bash
bun dev
```

---

# Deployment

The application is deployed using Lovable.

---

# Video Walkthrough

Video link:

`https://drive.google.com/file/d/1lyWO6Wx9RoEllfzoKZBotSbWhm7bVbdZ/view`

The video demonstrates:

* Authentication
* Lead creation
* Kanban flow
* Stage validation
* Campaigns
* AI message generation
* Dashboard
* Lead ownership
* Custom fields
* Technical decisions

---

# Author

Almyr Neto

GitHub:

`https://github.com/almyrneto`
