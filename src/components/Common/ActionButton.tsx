import { Button } from "@chakra-ui/react";
import useCustomToast from "../../hooks/useCustomToast";
import { DevicesService } from "../../client";
import type { DevicePublic } from "../../client";
import { useState, useEffect } from "react";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";

interface ActionsButtonProps {
  type: string;
  value: DevicePublic;
  disabled?: boolean;
  onItemChange?: () => void; // Callback to notify parent of device changes
}

const ActionsButton = ({ type, value, disabled, onItemChange }: ActionsButtonProps) => {
  const showToast = useCustomToast();
  const { activeOrganizationContext, getActiveOrganizationId } = useOrganizationContext();

  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [colorScheme, setColorScheme] = useState("blue");
  const [buttonText, setButtonText] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const activeOrgId = getActiveOrganizationId();
    if (!activeOrgId) {
      setIsEnabled(null);
      setColorScheme("gray");
      setButtonText("Select Organization");
      return;
    }

    // Check if the device is owned by the active organization
    if (value.owner_id === activeOrgId) {
      setIsEnabled(value.enabled || false);
      setColorScheme(value.enabled ? "red" : "green");
      setButtonText(value.enabled ? "Disable Device" : "Enable Device");
    } else {
      setIsEnabled(null);
      setColorScheme("gray");
      setButtonText("Not Owned");
    }
  }, [value, getActiveOrganizationId()]);

  const handleButtonClick = async () => {
    // Check if organization context is available
    const activeOrgId = getActiveOrganizationId();
    if (!activeOrgId) {
      showToast("Error", "Please select an organization first.", "error");
      return;
    }

    // Check if the device is owned by the active organization
    if (value.owner_id !== activeOrgId) {
      showToast("Info", "This device is not owned by your organization.", "info");
      return;
    }

    try {
      setIsLoading(true);
      
      // Toggle the enabled state
      const newEnabledState = !isEnabled;
      
      // Update the device
      await DevicesService.updateDevice({
        id: value.uid,
        requestBody: {
          enabled: newEnabledState,
          category: value.category, // Required field
        }
      });

      // Update local state
      setIsEnabled(newEnabledState);
      setColorScheme(newEnabledState ? "red" : "green");
      setButtonText(newEnabledState ? "Disable Device" : "Enable Device");

      // Show success message
      showToast(
        "Success", 
        `Device ${value.name} has been ${newEnabledState ? 'enabled' : 'disabled'}.`, 
        "success"
      );
      
      // Notify parent component to refresh device lists
      onItemChange?.();
      
    } catch (error) {
      console.error("Error updating device:", error);
      showToast("Error", "Failed to update device status.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        colorScheme={colorScheme} 
        size="sm" 
        onClick={handleButtonClick} 
        disabled={disabled || !getActiveOrganizationId() || value.owner_id !== getActiveOrganizationId()}
        isLoading={isLoading}
        loadingText={isEnabled ? "Disabling..." : "Enabling..."}
        title={
          !getActiveOrganizationId() 
            ? "Please select an organization first" 
            : value.owner_id !== getActiveOrganizationId()
            ? "This device is not owned by your organization"
            : isEnabled
            ? `Disable device ${value.name}`
            : `Enable device ${value.name}`
        }
      >
        {buttonText}
      </Button>
    </>
  );
};

export default ActionsButton;