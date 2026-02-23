import { useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '../contexts/OrganizationContext'
import type { UserPublic } from '../client'

/**
 * Hook that provides organization context utilities for components
 * Use this when you need to make API calls with organization context
 */
export const useOrganizationContext = () => {
  const queryClient = useQueryClient()
  const { activeOrganizationContext } = useOrganization()
  
  /**
   * Get the organization ID for the current context
   * Use this when making API calls that need organization-specific data
   */
  const getActiveOrganizationId = () => {
    return activeOrganizationContext?.uid || null
  }
  
  /**
   * Check if the user is viewing data from their own organization
   */
  const isViewingOwnOrganization = () => {
    const currentUser = queryClient.getQueryData<UserPublic>(['currentUser'])
    return currentUser?.organization_id === activeOrganizationContext?.uid
  }
  
  /**
   * Get the organization context for API calls
   * Returns the active organization context, or falls back to user's organization
   */
  const getOrganizationContextForAPI = () => {
    // If user has selected a different organization context, use that
    if (activeOrganizationContext) {
      return activeOrganizationContext
    }
    
    // Otherwise, use the user's own organization
    const currentUser = queryClient.getQueryData<UserPublic>(['currentUser'])
    if (currentUser?.organization_id) {
      return { uid: currentUser.organization_id }
    }
    
    return null
  }
  
  return {
    activeOrganizationContext,
    getActiveOrganizationId,
    isViewingOwnOrganization,
    getOrganizationContextForAPI
  }
} 