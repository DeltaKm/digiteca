# Overview

DigiteKa is a digital archive management system designed for cataloging and displaying historical documents and images. The application features a public frontend for document consultation and a protected admin backoffice for content management. Built with modern web technologies, it provides IIIF image viewing capabilities, advanced search functionality, and comprehensive document metadata management.

# Recent Changes

## September 30, 2025 - Multi-Document IIIF Manifest System

### Multi-Document Selection & Manifest Creation
- Implemented multi-document selection system in admin documents page
- Added checkbox selection with visual feedback and selection counter
- Created manifest editor modal for combining multiple documents into single IIIF manifest
- Integrated proper authentication with CSRF tokens for manifest API calls
- Added comprehensive loading states and error handling throughout workflow

### Database Schema Enhancement
- Added `iiifManifestId` field to documents table (varchar 100)
- Enables precise O(1) manifest lookup without pagination limits
- Deployed schema changes with `npm run db:push --force`
- Maintains backward compatibility with legacy archiveCode-based manifests

### Manifest Retrieval Optimization
- Implemented `getDocumentByManifestId()` in storage layer for direct database queries
- Updated `getManifest()` to use precise lookup with fallback to archiveCode for legacy data
- Eliminated pagination-related 404 errors when retrieving manifests
- Scalable solution works with 1000+ manifests

### URL Strategy & Routing
- Changed manifest URLs from absolute to relative format (`/manifests/{id}`)
- Added client-side URL normalization for backward compatibility
- Resolved CORS and connection errors in Mirador viewer
- Enhanced logging for manifest endpoint debugging

### Critical Mirador Viewer Fix (September 30, 2025)
- **Root Cause**: Manifest contained non-image resources (JSON manifest, PDF files) causing "unknown runtime error"
- **REPLIT_DOMAINS Fix**: Corrected base URL generation from `REPL_SLUG`+`REPL_OWNER` to `REPLIT_DOMAINS` environment variable
- **Image-Only Filter**: Added automatic filtering in multi-document selection to accept only image files (MIME type `image/*`)
- **User Feedback**: System now warns users when non-image documents are filtered out from manifest creation
- **Validation**: Prevents creation of invalid IIIF manifests with non-displayable resources
- **Impact**: Eliminates Mirador viewer errors by ensuring all manifest canvases point to actual images

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React using TypeScript and Vite as the build tool. The application uses a component-based architecture with shadcn/ui components for the design system. Routing is handled by Wouter for lightweight client-side navigation. The UI follows a clean, modern design with Tailwind CSS for styling and includes both light and dark theme support.

Key frontend decisions:
- **React + TypeScript**: Provides type safety and modern development experience
- **Vite**: Fast build tool with hot module replacement for development
- **shadcn/ui**: Comprehensive component library built on Radix UI primitives
- **Wouter**: Lightweight routing solution instead of React Router
- **TanStack Query**: Robust data fetching and caching solution

## Backend Architecture
The server follows an Express.js REST API pattern with TypeScript support. The application uses a monorepo structure with shared schemas between client and server. Authentication is handled through Replit's OIDC system with session-based user management.

Core backend components:
- **Express.js**: HTTP server framework with middleware-based architecture
- **TypeScript**: End-to-end type safety across the entire stack
- **Session-based auth**: Uses Replit OIDC with PostgreSQL session storage
- **Shared schemas**: Common type definitions between client and server using Zod

## Database Layer
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The schema supports hierarchical document organization with categories and subcategories, comprehensive metadata fields, and user management for authentication.

Database design decisions:
- **PostgreSQL**: Robust relational database for complex queries and data integrity
- **Drizzle ORM**: Type-safe database operations with excellent TypeScript integration
- **Neon Database**: Serverless PostgreSQL hosting solution for scalability
- **Schema-driven**: Uses Zod schemas for validation and type generation

## File Storage System
Object storage is implemented using Google Cloud Storage with an access control layer. The system supports both public and private file access with customizable ACL policies. Files are organized with proper metadata and MIME type detection.

Storage architecture:
- **Google Cloud Storage**: Scalable object storage for documents and images
- **ACL system**: Granular access control with user groups and permissions
- **MIME type handling**: Proper file type detection and handling
- **Presigned URLs**: Secure direct upload functionality

## Image Viewing
The application includes IIIF (International Image Interoperability Framework) support through OpenSeadragon for high-quality image viewing with zoom, pan, and rotation capabilities. This enables detailed examination of historical documents and images.

# External Dependencies

## Core Framework Dependencies
- **React**: UI framework for building interactive user interfaces
- **Express.js**: Node.js web framework for the REST API server
- **TypeScript**: Static typing for both client and server code
- **Vite**: Build tool and development server for the frontend

## Database and ORM
- **PostgreSQL**: Primary database (via Neon serverless)
- **Drizzle ORM**: Type-safe database toolkit and query builder
- **@neondatabase/serverless**: PostgreSQL connection pooling for serverless environments

## Authentication
- **Replit Auth**: OIDC-based authentication system
- **express-session**: Session management middleware
- **connect-pg-simple**: PostgreSQL-backed session store

## UI and Styling
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Unstyled, accessible UI components
- **Lucide React**: Icon library with consistent design

## File Management
- **Google Cloud Storage**: Object storage service for file uploads
- **Uppy**: File upload library with dashboard interface
- **OpenSeadragon**: IIIF image viewer for deep zoom functionality

## Data Management
- **TanStack Query**: Server state management and caching
- **Zod**: Schema validation library
- **React Hook Form**: Form state management and validation

## Development Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing tool
- **Autoprefixer**: CSS vendor prefix automation