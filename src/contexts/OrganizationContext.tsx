import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UsersService } from '../client'
import type { OrganizationPublic } from '../client'
import useCustomToast from '../hooks/useCustomToast'

interface OrganizationContextType {
  selectedOrganization: OrganizationPublic | null
  setSelectedOrganization: (org: OrganizationPublic | null) => void
  switchOrganization: (org: OrganizationPublic) => Promise<void>
  activeOrganizationContext: OrganizationPublic | null
  isLoading: boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

interface OrganizationProviderProps {
  children: ReactNode
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationPublic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  // Load selected organization from localStorage on mount
  useEffect(() => {
    const savedOrg = localStorage.getItem('selectedOrganization')
    if (savedOrg) {
      try {
        const parsedOrg = JSON.parse(savedOrg)
        setSelectedOrganization(parsedOrg)
        queryClient.setQueryData(['selectedOrganization'], parsedOrg)
      } catch (error) {
        console.error('Error parsing saved organization:', error)
      }
    }
    setIsLoading(false)
  }, [queryClient])

  // Update localStorage when organization changes
  useEffect(() => {
    if (selectedOrganization) {
      localStorage.setItem('selectedOrganization', JSON.stringify(selectedOrganization))
      queryClient.setQueryData(['selectedOrganization'], selectedOrganization)
    }
  }, [selectedOrganization, queryClient])

  // Function to switch organization context (not user membership)
  const switchOrganization = async (org: OrganizationPublic) => {
    try {
      setIsLoading(true)
      
      // Update local state for context switching
      setSelectedOrganization(org)
      
      // Store in localStorage for persistence
      localStorage.setItem('selectedOrganization', JSON.stringify(org))
      
      // Update query client cache
      queryClient.setQueryData(['selectedOrganization'], org)
      
      // Invalidate queries that might contain organization-specific data
      // This will force a refresh of data for the new organization context
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      
      // Show success message
      showToast(
        "Organization Context Switched",
        `Now viewing data from ${org.name}`,
        "success"
      )
      
    } catch (error) {
      console.error('Error switching organization context:', error)
      showToast(
        "Context Switch Failed",
        "Failed to switch organization context. Please try again.",
        "error"
      )
      
      // Revert to previous selection on error
      if (selectedOrganization) {
        localStorage.setItem('selectedOrganization', JSON.stringify(selectedOrganization))
        queryClient.setQueryData(['selectedOrganization'], selectedOrganization)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // The active organization context is the selected organization
  // This represents what organization's data the user is currently viewing
  const activeOrganizationContext = selectedOrganization

  const value = {
    selectedOrganization,
    setSelectedOrganization,
    switchOrganization,
    activeOrganizationContext,
    isLoading
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
} 