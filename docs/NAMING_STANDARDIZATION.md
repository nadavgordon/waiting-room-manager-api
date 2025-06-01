# Naming Standardization Plan

## Current Naming Inconsistencies

This document outlines the current naming inconsistencies in the Waiting Room Manager API project and provides a plan for standardization in future development iterations.

### Current Names

1. **Project/Package Name**: 
   - `waiting-room-manager-api` in package.json and documentation

2. **Kubernetes Resources**:
   - `waiting-room-api` in labels, selectors, container names
   - Image tag: `waiting-room-api:local`

3. **Kind Cluster Name**:
   - `waiting-room-dev` in documentation and instructions

## Standardization Options

### Option 1: Standardize on Full Name (Recommended)

1. **Project/Repository**: Keep as `waiting-room-manager-api`
2. **Docker Images**: Change to `waiting-room-manager-api:local` (or version tags)
3. **Kubernetes Resources**: Change labels to `app: waiting-room-manager-api`
4. **Kind Cluster**: Change to `waiting-room-manager` (shortened for practicality)

### Option 2: Standardize on Short Name

1. **Project/Repository**: Change to `waiting-room-api` (shorter, easier to type)
2. **Docker Images**: Keep as `waiting-room-api:local` (or version tags)
3. **Kubernetes Resources**: Keep labels as `app: waiting-room-api`
4. **Kind Cluster**: Change to `waiting-room-api` (matches other naming)

## Implementation Plan

### Phase 1: Documentation and Planning
- [x] Document current naming inconsistencies in README
- [x] Create this standardization plan document
- [ ] Choose preferred standardization option
- [ ] Create Git issue to track the standardization task

### Phase 2: Update References
- [ ] Update Docker build scripts and documentation
- [ ] Update Kubernetes manifests with new naming
- [ ] Update Kind cluster commands in documentation
- [ ] Update CI/CD pipeline configurations if applicable

### Phase 3: Testing and Rollout
- [ ] Test the updated configurations in a development environment
- [ ] Create a migration guide for other developers
- [ ] Implement changes in production environments

## Files Requiring Updates

### For Option 1 (Full Name)
1. **Kubernetes Manifests**:
   - `k8s/api-deployment.yaml`: Update all "waiting-room-api" to "waiting-room-manager-api"
   - `k8s/api-service.yaml`: Update all "waiting-room-api" to "waiting-room-manager-api"
   - Any other manifests referencing the app name

2. **Documentation**:
   - `README.md`: Update Docker build, Kind commands, and Kubernetes examples
   - Any other documentation referencing Docker images or Kubernetes resources

### For Option 2 (Short Name)
1. **Project Configuration**:
   - `package.json`: Change name from "waiting-room-manager-api" to "waiting-room-api"
   - `package-lock.json`: Will need to be regenerated

2. **Documentation**:
   - `README.md`: Update references to project name
   - Update Kind cluster name from "waiting-room-dev" to "waiting-room-api"

## Recommendations

1. **Timing**: Implement during a planned maintenance window or major version update
2. **Testing**: Thoroughly test all deployment scenarios before and after changes
3. **Communication**: Notify all team members of the standardization effort and timeline
4. **Version Control**: Use a dedicated Git branch for these changes
5. **Documentation**: Update all documentation to reflect the new naming conventions