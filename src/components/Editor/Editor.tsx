import { useState, useEffect, useRef, type ReactElement, useCallback } from "react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { CustomThemeProvider } from "@components/InteractivePlayground";
import { useComponents } from "@components/InteractivePlayground";
import InfoIcon from '@mui/icons-material/Info';
import FormatColorFill from '@mui/icons-material/FormatColorFill';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Restore from '@mui/icons-material/Restore';

// Declare global functions for dialog
/*
declare global {
  interface Window {
    __demoFunctions: {
      dialogOpen: boolean;
    };
  }
} 
*/

/**
 * The Editor component is a component that allows you to edit the code of a component.
 * It is used to create a code editor and a preview of the code.
 */
export function Editor({ code, setCode, onParsedCodeChange, handleReset, themeType }: EditorProps) {
  // Get components based on theme
  const components = useComponents();

  const [error, setError] = useState<string | null>(null);
  const [parsedCode, setParsedCode] = useState<React.ReactElement | null>(null);

  // State variables we need
  const [dropIndicators, setDropIndicators] = useState<
    Array<{ top: number; width: number }>
  >([]);
  const [activeIndicator, setActiveIndicator] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<HTMLElement[]>([]);

  // Add a new state variable to track active dragging
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Add state for tracking highlighted Box
  const [highlightedBoxId, setHighlightedBoxId] = useState<string | null>(null);

  // First, add a state to control when tooltips are visible
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Add these new state variables at the top of your component
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColorType, setSelectedColorType] = useState<
    "background" | "text"
  >("background");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [customCursor, setCustomCursor] = useState<string | null>(null);

  // Add a useEffect to apply the cursor to the entire document
  useEffect(() => {
    if (customCursor) {
      document.body.style.cursor = customCursor;
    } else {
      document.body.style.cursor = "";
    }

    // Cleanup function to reset cursor when component unmounts
    return () => {
      document.body.style.cursor = "";
    };
  }, [customCursor]);

  // Add this function to handle color selection
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setColorPickerOpen(false);

    // Create custom cursor style
    const cursorStyle = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="${encodeURIComponent(
      color,
    )}"/></svg>') 8 8, auto`;
    setCustomCursor(cursorStyle);
  };

  // Helper function to update code with new color
  const updateCodeWithColor = useCallback((element: HTMLElement, color: string, type: string) => {
    // Only proceed if element has an ID
    const id = element.id;
    if (!id) {
      console.log("Element has no ID, skipping code update");
      return;
    }

    // Determine color property based on current type
    const colorProp = type === "background" ? "background-color" : "color";
    const sxColorProp = type === "background" ? "bgcolor" : "color";

    console.log(`Updating ${type} color to ${color} for element with ID ${id}`);

    setCode((prevCode: string) => {
      try {
        // Find element by ID only
        const elementRegex = new RegExp(
          `<\\w+[^>]*id=["']${id}["'][^>]*>`,
          "i",
        );
        const match = elementRegex.exec(prevCode);

        if (!match || match.index === undefined) {
          console.log(`Couldn't find element with id "${id}" in code`);
          return prevCode;
        }

        const elementStart = match.index;
        const elementTag = match[0];

        // Extract the tag name
        const tagMatch = /<(\w+)/.exec(elementTag);
        const tagName = tagMatch ? tagMatch[1] : "";

        // Special case for Button elements
        if (tagName === "Button") {
          // Determine the correct property name for background
          const buttonColorProp =
            type === "background" ? "backgroundColor" : "color";

          // Check if Button already has a style prop
          if (
            elementTag.includes("style={") ||
            elementTag.includes("style={{")
          ) {
            const styleMatch =
              /style=\{(\{[^}]*\})\}/.exec(elementTag) ||
              /style=\{\{([^}]*)\}\}/.exec(elementTag);

            if (styleMatch && styleMatch[1]) {
              const styleContent = styleMatch[1];

              // Create regex to find the specific property
              const testRegex = new RegExp(
                `(^|[\\s,{])${buttonColorProp}\\s*:\\s*["']?[^,"'{}]+["']?`,
                "g",
              );

              // Check if this property exists
              const hasProperty = testRegex.test(styleContent);

              let updatedStyle;
              if (hasProperty) {
                // Create a fresh regex for replacement
                const replaceRegex = new RegExp(
                  `(^|[\\s,{])(${buttonColorProp})\\s*:\\s*["']?[^,"'{}]+["']?`,
                  "g",
                );
                // Replace the property - WITHOUT quotes for Button
                updatedStyle = styleContent.replace(
                  replaceRegex,
                  `$1$2: ${color}`,
                );
              } else {
                // Add new property
                const lastBraceIndex = styleContent.lastIndexOf("}");
                updatedStyle =
                  styleContent.substring(0, lastBraceIndex) +
                  (styleContent.trim().length > 2 ? ", " : "") +
                  `${buttonColorProp}: ${color}` +
                  styleContent.substring(lastBraceIndex);
              }

              const updatedTag = elementTag.replace(styleContent, updatedStyle);
              return (
                prevCode.substring(0, elementStart) +
                updatedTag +
                prevCode.substring(elementStart + elementTag.length)
              );
            }
          } else {
            // Add new style prop for Button
            const closingBracketIndex = elementTag.lastIndexOf(">");
            const updatedTag =
              elementTag.substring(0, closingBracketIndex) +
              ` style={{${buttonColorProp}: ${color}}}` +
              elementTag.substring(closingBracketIndex);

            return (
              prevCode.substring(0, elementStart) +
              updatedTag +
              prevCode.substring(elementStart + elementTag.length)
            );
          }
        }

        // Regular processing for other elements
        // Check if element uses sx prop
        if (elementTag.includes("sx={") || elementTag.includes("sx={{")) {
          // Handle sx prop
          const sxMatch =
            /sx=\{(\{[^}]*\})\}/.exec(elementTag) ||
            /sx=\{\{([^}]*)\}\}/.exec(elementTag);

          if (sxMatch && sxMatch[1]) {
            const sxContent = sxMatch[1];

            // More precise regex with word boundaries to match exact property
            // This ensures we don't match substrings of other properties
            const sxColorRegex = new RegExp(
              `(\\b${sxColorProp}\\b)\\s*:\\s*(["']?[^,"'{}]+["']?)`,
              "g",
            );

            // Check if this SPECIFIC property exists
            const hasSxColor = sxColorRegex.test(sxContent);

            let updatedSx;
            if (hasSxColor) {
              // Reset regex lastIndex
              sxColorRegex.lastIndex = 0;
              // Replace only the exact property - WITH quotes for sx
              updatedSx = sxContent.replace(sxColorRegex, `$1: "${color}"`);
            } else {
              // Add new color property - WITH quotes for sx
              const lastBraceIndex = sxContent.lastIndexOf("}");
              updatedSx =
                sxContent.substring(0, lastBraceIndex) +
                (sxContent.trim().length > 2 ? ", " : "") +
                `${sxColorProp}: "${color}"` +
                sxContent.substring(lastBraceIndex);
            }

            const updatedTag = elementTag.replace(sxContent, updatedSx);
            return (
              prevCode.substring(0, elementStart) +
              updatedTag +
              prevCode.substring(elementStart + elementTag.length)
            );
          }
        }
        // Check if element uses style prop
        else if (
          elementTag.includes("style={") ||
          elementTag.includes("style={{")
        ) {
          // Handle style prop
          const styleMatch =
            /style=\{(\{[^}]*\})\}/.exec(elementTag) ||
            /style=\{\{([^}]*)\}\}/.exec(elementTag);

          if (styleMatch && styleMatch[1]) {
            const styleContent = styleMatch[1];

            // Create separate regex instances for testing and replacing
            // Use pattern that works with hyphenated properties
            const testRegex = new RegExp(
              `(^|[\\s,{])${colorProp}\\s*:\\s*["']?[^,"'{}]+["']?`,
              "g",
            );

            // Check if this SPECIFIC property exists
            const hasStyleColor = testRegex.test(styleContent);

            let updatedStyle;
            if (hasStyleColor) {
              // Create a fresh regex for replacement to avoid lastIndex issues
              const replaceRegex = new RegExp(
                `(^|[\\s,{])(${colorProp})\\s*:\\s*["']?[^,"'{}]+["']?`,
                "g",
              );
              // Replace only the exact property - WITHOUT quotes for style
              updatedStyle = styleContent.replace(
                replaceRegex,
                `$1$2: ${color}`,
              );
            } else {
              // Add new color property - WITHOUT quotes for style
              const lastBraceIndex = styleContent.lastIndexOf("}");
              updatedStyle =
                styleContent.substring(0, lastBraceIndex) +
                (styleContent.trim().length > 2 ? ", " : "") +
                `${colorProp}: ${color}` +
                styleContent.substring(lastBraceIndex);
            }

            const updatedTag = elementTag.replace(styleContent, updatedStyle);
            return (
              prevCode.substring(0, elementStart) +
              updatedTag +
              prevCode.substring(elementStart + elementTag.length)
            );
          }
        }
        // No existing style/sx props, add style prop
        else {
          const closingBracketIndex = elementTag.lastIndexOf(">");
          const isComponent = tagName && /^[A-Z]/.test(tagName);

          const propName = isComponent ? "sx" : "style";
          // Format based on prop type
          const colorValue = isComponent ? `"${color}"` : color;
          // Color prop type
          const colorPropType = isComponent ? sxColorProp : colorProp;

          const updatedTag =
            elementTag.substring(0, closingBracketIndex) +
            ` ${propName}={{${colorPropType}: ${colorValue}}}` +
            elementTag.substring(closingBracketIndex);

          return (
            prevCode.substring(0, elementStart) +
            updatedTag +
            prevCode.substring(elementStart + elementTag.length)
          );
        }

        return prevCode;
      } catch (error) {
        console.error("Error updating code with color:", error);
        return prevCode;
      }
    });
  }, []);

  // Add this function to reset the cursor when clicking on an element
  const handleResetCursor = useCallback((e: MouseEvent) => {
    if (!customCursor || !selectedColor) return;

    // Check if click is inside preview container
    if (previewRef.current && previewRef.current.contains(e.target as Node)) {
      const targetElement = e.target as HTMLElement;

      // Skip if clicking on the preview container itself
      if (targetElement === previewRef.current) {
        setCustomCursor(null);
        setSelectedColor(null);
        return;
      }

      // Store current color type to use consistently
      const colorType = selectedColorType;

      // Only update the code - let the re-render handle the visual update
      updateCodeWithColor(targetElement, selectedColor, colorType);
    }

    // Reset cursor
    setCustomCursor(null);
    setSelectedColor(null);
  }, [customCursor, selectedColor, previewRef, selectedColorType, updateCodeWithColor, setCustomCursor, setSelectedColor]);

  // Add this effect to handle document clicks to reset the cursor
  useEffect(() => {
    if (!customCursor) return;

    const handleDocumentClick = (e: MouseEvent) => {
      handleResetCursor(e);
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [customCursor, selectedColor, selectedColorType, handleResetCursor]);

  // Fallback render function (existing code)
  function fallbackRender({
    error,
    resetErrorBoundary,
  }: {
    error: Error;
    resetErrorBoundary: () => void;
  }): ReactElement {
    return (
      <components.Typography color="error">
        <components.Stack direction="row" spacing={2} alignItems="center">
          <components.AlertIcon />
          <components.Box>{error?.message}</components.Box>
          <components.Button
            variant="text"
            onClick={resetErrorBoundary}
            sx={{ ml: 2 }}
          >
            Retry
          </components.Button>
        </components.Stack>
      </components.Typography>
    );
  }

  // Handle drag start for component
  const handleDragStart = (e: React.DragEvent, component: string) => {
    e.dataTransfer.setData("component", component);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    // Set dragging state to true
    setIsDraggingOver(true);

    if (!previewRef.current) return;

    // Find if we're over a Box component by traversing up from target
    let currentElement = e.target as HTMLElement;
    let boxElement: HTMLElement | null = null;

    // Traverse up to find Box component
    while (currentElement && currentElement !== previewRef.current) {
      // Check if this is a Box component (not the main container)
      if (
        currentElement.className?.includes("MuiBox-root") &&
        currentElement !== previewRef.current &&
        !currentElement.contains(previewRef.current)
      ) {
        boxElement = currentElement;
        break;
      }
      currentElement = currentElement.parentElement as HTMLElement;
    }

    if (boxElement) {
      // We're over a Box - highlight it
      // Make sure box has an ID by generating one if needed
      if (!boxElement.id) {
        boxElement.id = `box-${Date.now()}`;
      }

      setHighlightedBoxId(boxElement.id);

      // Clear the regular drop indicators when over a Box
      setActiveIndicator(null);
      return;
    }

    // Not over a Box, reset box highlighting
    setHighlightedBoxId(null);

    // Only process regular indicators when not over a Box
    const previewRect = previewRef.current.getBoundingClientRect();
    const mouseY = e.clientY - previewRect.top;

    // Find the closest indicator
    if (dropIndicators.length > 0) {
      let closestIdx = 0;
      let minDistance = Math.abs(mouseY - dropIndicators[0].top);

      dropIndicators.forEach((indicator, idx) => {
        const distance = Math.abs(mouseY - indicator.top);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      setActiveIndicator(closestIdx);
    }
  };

  // Add a handleDragLeave function
  const handleDragLeave = (e: React.DragEvent) => {
    // Check if we've actually left the container (not just entered a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
      setActiveIndicator(null);
      setHighlightedBoxId(null);
    }
  };

  // Get code snippet for the dropped component
  const getComponentCode = (component: string) => {
    const uniqueId = `box-${Date.now()}`;

    switch (component) {
      case "Box":
        return `<Box id="${uniqueId}" sx={{ p: 2, mt: 2 }}>New Box</Box>\n`;
      case "Chip":
        return '<Chip sx={{ mt: 2 }} label="New Chip" color="primary" variant="outlined" />\n';
      case "Dialog":
        return `<Box id="${uniqueId}" sx={{ p: 2, mt: 2 }}>
            <Button 
              variant="contained"
              id="open-dialog-button"
            >Open Dialog</Button>
            <Dialog 
              open={false}
              id="demo-dialog"
              aria-labelledby="dialog-title" 
              aria-describedby="dialog-description"
            >
              <DialogTitle id="dialog-title">Dialog Title</DialogTitle>
              <DialogContent>
                <DialogContentText id="dialog-description">
                  This is a sample dialog content. You can place any content here.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button 
                  variant="outlined"
                  id="close-dialog-button"
                >Cancel</Button>
                <Button variant="contained">Confirm</Button>
              </DialogActions>
            </Dialog>
          </Box>\n`;
      default:
        return "";
    }
  };

  // Helper function for consistent element insertion
  function insertComponentIntoCode(
    prevCode: string,
    newComponentCode: string,
    position: number,
    isAppend = false,
  ): string {
    // Clean up component code to ensure proper newlines
    const cleanComponentCode = newComponentCode.trim();

    // When appending to the end
    if (isAppend) {
      const hasNewlineAtEnd = prevCode.endsWith("\n");
      return (
        prevCode +
        (hasNewlineAtEnd ? "" : "\n") +
        "\n" +
        cleanComponentCode +
        "\n"
      );
    }

    // When inserting at the start
    if (position === 0) {
      return cleanComponentCode + "\n\n" + prevCode;
    }

    // When inserting in the middle
    return [
      prevCode.slice(0, position),
      "\n\n" + cleanComponentCode,
      prevCode.slice(position),
    ].join("");
  }

  // Handle drop to insert component at indicator position
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const component = e.dataTransfer.getData("component");
    if (!component) return;

    // Check for Dialog constraint
    if (component === "Dialog") {
      if (hasDialog) {
        setWarningMessage(
          "Only one Dialog component can be added. Please remove the existing Dialog first.",
        );
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
        return;
      }
    }

    // Generate component code
    const newComponentCode = getComponentCode(component);

    // CASE 1: Dropping inside a highlighted Box
    if (highlightedBoxId) {
      setCode((prevCode: string) => {
        try {
          // We need to properly find the Box with its matching closing tag
          // using a stack-based approach to handle nesting
          let boxStartIndex = -1;
          let boxEndIndex = -1;

          // Find the opening tag for our Box by ID
          const boxOpenRegex = new RegExp(
            `<Box[^>]*id=["']${highlightedBoxId}["'][^>]*>`,
            "i",
          );
          const openMatch = boxOpenRegex.exec(prevCode);

          if (openMatch && openMatch.index !== undefined) {
            boxStartIndex = openMatch.index;

            // Now find the matching closing tag using a stack
            let depth = 1; // We start after the opening tag
            let pos = boxStartIndex + openMatch[0].length;

            while (pos < prevCode.length && depth > 0) {
              // Find next tag
              const nextOpenTag = prevCode.indexOf("<Box", pos);
              const nextCloseTag = prevCode.indexOf("</Box>", pos);

              // No more tags
              if (nextCloseTag === -1) break;

              // Found opening tag before closing tag
              if (nextOpenTag !== -1 && nextOpenTag < nextCloseTag) {
                depth++;
                pos = nextOpenTag + 4; // Skip to after '<Box'
              } else {
                // Found closing tag
                depth--;
                if (depth === 0) {
                  // This is our matching closing tag
                  boxEndIndex = nextCloseTag; // Store position of </Box>
                }
                pos = nextCloseTag + 6; // Skip to after '</Box>'
              }
            }

            if (boxEndIndex !== -1) {
              // We found our Box's matching closing tag!
              // Determine indentation level
              const lastNewlineIndex = prevCode.lastIndexOf("\n", boxEndIndex);
              const indentation =
                lastNewlineIndex >= 0
                  ? prevCode
                    .substring(
                      lastNewlineIndex + 1,
                      prevCode.indexOf("<", lastNewlineIndex),
                    )
                    .match(/^\s*/)?.[0] || ""
                  : "";

              // Add extra indentation for the new component
              const componentIndentation = indentation + "  ";

              // Format component with proper indentation
              const formattedComponent = newComponentCode
                .split("\n")
                .map((line) =>
                  line.trim() ? componentIndentation + line : line,
                )
                .join("\n");

              // Insert the component before the closing tag
              return [
                prevCode.slice(0, boxEndIndex),
                "\n" + formattedComponent,
                prevCode.slice(boxEndIndex),
              ].join("");
            }
          }
          return prevCode;
        } catch (error) {
          console.error("Error inserting into Box:", error);
          return prevCode;
        } finally {
          setHighlightedBoxId(null);
        }
      });

      return;
    }

    // CASE 2: Regular drop at an indicator position
    if (activeIndicator !== null) {
      // Only allow Box as a root element
      if (component !== "Box") {
        setWarningMessage(`Only Box components can be added as root elements.`);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
        return;
      }

      setCode((prevCode: string) => {
        try {
          // Find positions of all root elements in the code
          const rootElements = findRootElements(prevCode);

          // Handle empty code case
          if (prevCode.trim() === "") {
            return newComponentCode;
          }

          // Handle insertion at the beginning
          if (activeIndicator === 0) {
            return insertComponentIntoCode(prevCode, newComponentCode, 0);
          }

          // Handle insertion between elements
          if (activeIndicator <= rootElements.length) {
            const previousElementEnd = rootElements[activeIndicator - 1].end;
            return insertComponentIntoCode(
              prevCode,
              newComponentCode,
              previousElementEnd,
            );
          }

          // Handle insertion at the end
          return insertComponentIntoCode(prevCode, newComponentCode, 0, true);
        } catch (error) {
          console.error("Error inserting component:", error);
          return prevCode;
        }
      });
    }

    setActiveIndicator(null);
  };

  // Improved findRootElements to be more robust
  function findRootElements(code: string) {
    const elements = [];
    let depth = 0;
    let start = -1;
    let end = -1;
    let inString = false;
    let stringChar = "";

    // More robust parser to find root-level JSX elements
    for (let i = 0; i < code.length; i++) {
      // Handle string literals to avoid confusing them with tags
      if (
        (code[i] === '"' || code[i] === "'") &&
        (i === 0 || code[i - 1] !== "\\")
      ) {
        if (!inString) {
          inString = true;
          stringChar = code[i];
        } else if (code[i] === stringChar) {
          inString = false;
        }
        continue;
      }

      // Skip processing tags inside string literals
      if (inString) continue;

      if (code[i] === "<" && code[i + 1] !== "/") {
        // Opening tag
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (code[i] === "<" && code[i + 1] === "/") {
        // Closing tag
        depth--;
        if (depth === 0) {
          // Find the end of this tag
          end = code.indexOf(">", i) + 1;
          if (end > 0) {
            elements.push({ start, end });
            i = end - 1; // Skip to the end of this element
          }
        }
      } else if (code[i] === "/" && code[i + 1] === ">" && depth === 1) {
        // Self-closing tag at root level
        depth--;
        end = i + 2;
        elements.push({ start, end });
        i = end - 1;
      }
    }

    return elements;
  }

  // Parse the JSX code and convert it to a React element
  useEffect(() => {
    try {
      const newParsedCode = parseJSX(code, components);
      setParsedCode(newParsedCode as React.ReactElement);
      // Send the parsed code up to the parent component
      onParsedCodeChange?.(newParsedCode as React.ReactElement);
      setError(null);
    } catch (err: unknown) {
      console.error("Error parsing JSX:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      // Send null to the parent when there's an error
      onParsedCodeChange?.(null as unknown as React.ReactElement);
    }
  }, [code, onParsedCodeChange]);

  // Update the useEffect that calculates drop indicators
  useEffect(() => {
    if (!previewRef.current) return;

    // Get only the direct children of the preview container
    const childElements = Array.from(
      previewRef.current.querySelectorAll(":scope > *"),
    );
    elementsRef.current = childElements as HTMLElement[];

    // Calculate positions for indicators
    const indicators = [];
    const previewRect = previewRef.current.getBoundingClientRect();

    // Add an indicator at the very top (position 0)
    indicators.push({
      top: 0,
      width: previewRef.current.clientWidth,
    });

    // Add indicators after each element with additional debugging
    elementsRef.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();

      indicators.push({
        top: rect.bottom - previewRect.top + 5, // 5px spacing
        width: previewRect.width,
        element: el.tagName, // Just for debugging
        index: idx,
      });
    });

    // Ensure minimum spacing between indicators (10px)
    for (let i = 1; i < indicators.length; i++) {
      if (indicators[i].top - indicators[i - 1].top < 10) {
        indicators[i].top = indicators[i - 1].top + 10;
      }
    }

    setDropIndicators(indicators);
  }, [parsedCode]); // Recalculate when the preview content changes

  // Add these states to your Demo component
  const [dialogElement, setDialogElement] = useState<React.ReactElement | null>(
    null,
  );

  // Add these states to track dialog presence and warnings
  const [hasDialog, setHasDialog] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Add this effect to extract and parse Dialog content from code changes
  useEffect(() => {
    try {
      // Check if code contains a Dialog component
      const dialogCount = (code.match(/<Dialog/g) || []).length;
      setHasDialog(dialogCount > 0);

      // Find the Dialog component in the code
      const dialogMatch = code.match(/<Dialog[^>]*>([\s\S]*?)<\/Dialog>/);

      if (dialogMatch && dialogMatch[0]) {
        // Extract the complete Dialog with its contents
        const dialogCode = `<Box>${dialogMatch[0]}</Box>`;

        // Parse the Dialog using your existing parseJSX function
        const parsedDialog = parseJSX(dialogCode, components);

        if (parsedDialog) {
          // Store the parsed Dialog (second child of Box)
          const dialogChildren = React.Children.toArray(
            parsedDialog.props.children,
          );
          if (dialogChildren.length > 0) {
            setDialogElement(dialogChildren[0] as React.ReactElement);
          }
        }
      }
    } catch (error) {
      console.error("Error extracting and parsing dialog content:", error);
    }
  }, [code]);

  // Add state to track the root
  const [dialogRoot, setDialogRoot] = useState<ReturnType<
    typeof createRoot
  > | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Modify the global event handler to use the parsed Dialog element
  useEffect(() => {
    const handleDialogButtonClicks = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;

      if (button.id === "open-dialog-button") {
        const dialogContainer = document.getElementById(
          "dynamic-dialog-container",
        );
        if (dialogContainer && dialogElement) {
          // Clean up any existing root
          if (dialogRoot) {
            dialogRoot.unmount();
          }

          // Create a new root
          const newRoot = createRoot(dialogContainer);
          setDialogRoot(newRoot);

          // Clone dialog with open=true and onClose handler
          const openDialog = React.cloneElement(dialogElement, {
            open: true,
            onClose: () => {
              newRoot.unmount();
              setIsDialogOpen(false);
              setDialogRoot(null);
            },
          });

          // Render with the new root
          newRoot.render(
            <CustomThemeProvider theme={themeType}>
              {openDialog}
            </CustomThemeProvider>,
          );
          setIsDialogOpen(true);
        }
      }

      if (button.id === "close-dialog-button") {
        if (dialogRoot) {
          dialogRoot.unmount();
          setDialogRoot(null);
          setIsDialogOpen(false);
        }
      }
    };

    document.addEventListener("click", handleDialogButtonClicks);

    return () => {
      // Clean up on component unmount
      document.removeEventListener("click", handleDialogButtonClicks);
      if (dialogRoot) {
        dialogRoot.unmount();
      }
    };
  }, [dialogElement, isDialogOpen, dialogRoot]);

  // Add this effect to handle clicks outside tooltips
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeTooltip) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeTooltip]);

  // CSS for rendering the drop indicators
  const dropIndicatorStyle: React.CSSProperties = {
    position: "absolute",
    left: 20,
    height: 3,
    backgroundColor: "#ccc",
    zIndex: 1000,
    pointerEvents: "none",
    // Make sure it's clearly visible even with limited space
    minHeight: 3,
    boxShadow: "0 0 2px rgba(0,0,0,0.2)",
  };

  const activeDropIndicatorStyle: React.CSSProperties = {
    ...dropIndicatorStyle,
    backgroundColor: "#2196f3",
    height: 4,
  };

  return (
    <components.Box sx={{ p: "8px 12px" }}>
      <components.Typography
        variant="caption"
        sx={{ mt: 2, display: "block", fontSize: "0.8rem" }}
      >
        Drag and drop components from the toolbar to add them to your design.
      </components.Typography>
      {/* Component Toolbar */}
      <components.Paper
        elevation={1}
        sx={{
          p: 1,
          mb: 2,
          display: "flex",
          gap: 2,
          bgcolor: "grey.100",
        }}
      >
        <components.Stack>
          <components.Stack direction="row" spacing={4} alignItems="center">
            <components.Typography variant="label" sx={{ fontWeight: "bold", pl: 1, fontSize: "0.8rem" }}>Component Toolbar:</components.Typography>

            {/* Box */}
            <components.Tooltip
              open={activeTooltip === "box"}
              title={
                <components.Typography
                  sx={{ p: 1, maxWidth: 300, color: "white" }}
                >
                  {`Box is a layout component that serves as a wrapper for other
                  components. Use it to control spacing, padding, borders, and
                  create structured layouts. It's ideal for grouping related
                  components and applying consistent styling.`}
                </components.Typography>
              }
              placement="bottom-start"
              arrow
            >
              <components.Box
                draggable
                onDragStart={(e: React.DragEvent) => handleDragStart(e, "Box")}
                onDoubleClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setActiveTooltip(activeTooltip === "box" ? null : "box");
                }}
                sx={{
                  width: 60,
                  height: 40,
                  border: "1px dashed grey",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "grab",
                  "&:hover": {
                    bgcolor: "primary.light",
                  },
                }}
              >
                Box
              </components.Box>
            </components.Tooltip>

            {/* Chip */}
            <components.Chip
              sx={{
                mt: "auto",
                mb: "auto",
                border: "1px dashed grey",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "grab",
                "&:hover": {
                  bgcolor: "primary.light",
                },
              }}
              label="Chip"
              size="small"
              draggable
              onDragStart={(e: React.DragEvent) => handleDragStart(e, "Chip")}
            />

            {/* Dialog */}
            <components.Box
              draggable
              onDragStart={(e: React.DragEvent) => handleDragStart(e, "Dialog")}
              sx={{
                width: 60,
                height: 40,
                borderRadius: 1,
                boxShadow: 1,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                cursor: "grab",
                "&:hover": {
                  boxShadow: 2,
                },
              }}
            >
              {/* Dialog header */}
              <components.Box
                sx={{
                  height: "20%",
                  width: "100%",
                  bgcolor: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  pl: 0.5,
                }}
              >
                <components.Box
                  sx={{
                    height: "2px",
                    width: "30%",
                    bgcolor: "white",
                    borderRadius: "1px",
                  }}
                />
              </components.Box>

              {/* Dialog content */}
              <components.Box
                sx={{
                  height: "60%",
                  width: "100%",
                  bgcolor: "background.paper",
                  p: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <components.Box
                  sx={{
                    height: "4px",
                    width: "80%",
                    bgcolor: "text.disabled",
                    borderRadius: "1px",
                    mb: 0.5,
                  }}
                />
              </components.Box>

              {/* Dialog actions */}
              <components.Box
                sx={{
                  height: "20%",
                  width: "100%",
                  bgcolor: "background.default",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 0.5,
                  pr: 0.5,
                  mb: 0.5,
                }}
              >
                <components.Box
                  sx={{
                    height: "10px",
                    width: "16px",
                    border: "1px solid",
                    borderColor: "primary.main",
                    borderRadius: "2px",
                  }}
                />
                <components.Box
                  sx={{
                    height: "10px",
                    width: "16px",
                    bgcolor: "primary.main",
                    borderRadius: "2px",
                  }}
                />
              </components.Box>
            </components.Box>
          </components.Stack>
          <components.Box>
            <components.Typography
              variant="caption"
              sx={{
                mt: 1,
                display: "block",
                width: "fit-content",
                fontSize: "0.8rem",
              }}
            >
              <InfoIcon
                sx={{ fontSize: 14, verticalAlign: "sub", mr: 0.5 }}
              />
              Double-click any component icon for usage description
            </components.Typography>
          </components.Box>
        </components.Stack>
      </components.Paper>

      {/* Color Tool */}
      <components.Paper
        elevation={1}
        sx={{
          width: "fit-content",
          p: 1.5,
          mb: 2,
          display: "flex",
          justifyContent: "",
          alignItems: "center",
          bgcolor: "grey.100",
          position: "relative",
          ...(customCursor ? { cursor: customCursor } : {}),
          marginLeft: "auto", // Add this to push it to the right
        }}
      >

        <components.Stack>
          <components.Typography variant="label" sx={{ fontWeight: "bold", pl: 1, fontSize: "0.8rem" }}>Color Tool:</components.Typography>

          <components.Stack direction="row" alignItems="center">
            <components.FormControl>
              <components.RadioGroup
                row
                value={selectedColorType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSelectedColorType(e.target.value as "background" | "text")
                }
              >
                <components.FormControlLabel
                  value="background"
                  control={<components.Radio size="small" />}
                  label={<components.Typography variant="label" sx={{ fontSize: "0.8rem" }}>Background</components.Typography>}
                />
                <components.FormControlLabel
                  value="text"
                  control={<components.Radio size="small" />}
                  label={<components.Typography variant="label" sx={{ fontSize: "0.8rem" }}>Text</components.Typography>}
                />
              </components.RadioGroup>
            </components.FormControl>

            <components.Box>
              <components.Button
                variant="outlined"
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                startIcon={<FormatColorFill />}
                endIcon={<ExpandMore />}
                sx={{
                  borderColor: selectedColor,
                  color: selectedColor,
                  "&:hover": { borderColor: selectedColor, opacity: 0.8 },
                }}
                size="small"
              >
                <components.Typography variant="label" sx={{ fontSize: "0.8rem" }}>Choose color</components.Typography>
              </components.Button>

              {colorPickerOpen && (
                <components.Paper
                  elevation={3}
                  sx={{
                    position: "absolute",
                    right: 16,
                    top: "100%",
                    mt: 1,
                    p: 2,
                    zIndex: 1500,
                    width: 220,
                  }}
                >
                  <components.Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Select a color:
                  </components.Typography>

                  <components.Grid container spacing={1}>
                    {[
                      "#f44336",
                      "#e91e63",
                      "#9c27b0",
                      "#673ab7",
                      "#3f51b5",
                      "#2196f3",
                      "#03a9f4",
                      "#00bcd4",
                      "#009688",
                      "#4caf50",
                      "#8bc34a",
                      "#cddc39",
                      "#ffeb3b",
                      "#ffc107",
                      "#ff9800",
                      "#ff5722",
                      "#795548",
                      "#9e9e9e",
                      "#607d8b",
                      "#000000",
                    ].map((color) => (
                      <components.Grid size={{ xs: 3 }} key={color}>
                        <components.Tooltip
                          title={
                            <components.Box>
                              <svg width="24" height="24" viewBox="0 0 24 24">
                                <polygon
                                  points="12,2 22,12 12,22 2,12"
                                  fill={color}
                                  stroke="#000"
                                  strokeWidth="0.5"
                                />
                              </svg>
                              <components.Typography variant="caption">
                                {color}
                              </components.Typography>
                            </components.Box>
                          }
                          arrow
                        >
                          <components.Box
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation(); // Prevent document click from triggering
                              handleColorSelect(color);
                            }}
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: color,
                              borderRadius: "4px",
                              cursor: "pointer",
                              border: "1px solid #ddd",
                              "&:hover": {
                                transform: "scale(1.1)",
                                boxShadow: 2,
                              },
                            }}
                          />
                        </components.Tooltip>
                      </components.Grid>
                    ))}
                  </components.Grid>
                </components.Paper>
              )}
            </components.Box>
          </components.Stack>
        </components.Stack>
      </components.Paper>

      {/* Warning message */}
      {showWarning && (
        <components.Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setShowWarning(false)}
        >
          {warningMessage}
        </components.Alert>
      )}

      {/* Editor labels row */}
      <components.Box sx={{ display: "flex", mb: 1 }}>
        {/* Left side label (for code editor) */}
        <components.Box
          sx={{
            width: "30%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <components.Typography variant="subtitle2">
            Editor:
          </components.Typography>
          <components.Button
            onClick={handleReset}
            variant="outlined"
            color="secondary"
            startIcon={<Restore />}
            size="small"
          >
            Reset
          </components.Button>
        </components.Box>

        {/* Spacing */}
        <components.Box sx={{ width: "15px" }} />

        {/* Right side label (for preview) */}
        <components.Box
          sx={{
            width: "70%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <components.Typography variant="subtitle2">
            Preview:
          </components.Typography>
        </components.Box>
      </components.Box>

      {/* Editor */}
      <components.Stack direction="row" spacing={2} sx={{ height: "700px" }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            fontFamily: "monospace",
            width: "30%",
            height: "100%",
            fontSize: "14px",
          }}
        />

        <components.Paper
          elevation={2}
          sx={{
            width: "70%",
            p: 2,
            overflow: "auto",
            position: "relative",
            bgcolor: "background.default",
          }}
        >
          <components.Box
            ref={previewRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragEnter={(e: React.DragEvent) => e.preventDefault()}
            sx={{
              p: 2,
              bgcolor: "grey.100",
              borderRadius: 1,
              height: "100%",
              border: "2px dashed transparent",
              position: "relative",
              "&:hover": {
                border: "2px dashed grey",
              },
            }}
          >
            {/* Box highlighting styles - add this */}
            {highlightedBoxId && (
              <style>
                {`#${highlightedBoxId} {
                    outline: 2px dashed #2196f3 !important;
                    outline-offset: 2px !important;
                    background-color: rgba(33, 150, 243, 0.1) !important;
                  }
                `}
              </style>
            )}

            {/* Drop indicators */}
            {isDraggingOver &&
              !highlightedBoxId &&
              dropIndicators.map((indicator, index) => (
                <div
                  key={`indicator-${index}`}
                  style={{
                    ...(activeIndicator === index
                      ? activeDropIndicatorStyle
                      : dropIndicatorStyle),
                    top: `${indicator.top}px`,
                    width: `${indicator.width - 40}px`,
                  }}
                />
              ))}

            <ErrorBoundary fallbackRender={fallbackRender}>
              {!error ? parsedCode : error}
            </ErrorBoundary>
          </components.Box>
        </components.Paper>
      </components.Stack>

      <>
        {/* Dynamic Dialog Container */}
        <div id="dynamic-dialog-container"></div>
      </>
    </components.Box>
  );
}

interface EditorProps {
  /**
   * The parsed code from the editor.
   */
  onParsedCodeChange: (parsedCode: React.ReactElement) => void;
  handleReset: () => void;
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
  themeType: "default-theme" | "other-theme";
}

type TokenType = "openTag" | "closeTag" | "text" | "expression";

interface Token {
  type: TokenType;
  tagName?: string;
  attrs?: Record<string, unknown>;
  selfClosing?: boolean;
  value?: string;
}

interface TreeNode {
  type: string | TokenType;
  props?: Record<string, unknown>;
  children: Array<TreeNode | string>;
  value?: string;
}

type ComponentProps = Record<string, unknown>;

export function parseJSX(jsxString: string, components: Record<string, React.ComponentType<ComponentProps>>): React.ReactElement | null {
  // Tokenize the JSX string
  let currentIndex = 0;
  const tokens: Token[] = [];

  // Helper to consume until a specific character
  function consumeUntil(endChar: string): string {
    const start = currentIndex;
    while (
      currentIndex < jsxString.length &&
      jsxString[currentIndex] !== endChar
    ) {
      currentIndex++;
    }
    return jsxString.substring(start, currentIndex);
  }

  // Parse the JSX into tokens
  while (currentIndex < jsxString.length) {
    const char = jsxString[currentIndex];

    if (char === "<") {
      // Opening or closing tag
      if (jsxString[currentIndex + 1] === "/") {
        // Closing tag
        currentIndex += 2;
        const tagName = consumeUntil(">");
        tokens.push({ type: "closeTag", tagName });
        currentIndex++; // Skip '>'
      } else {
        // Opening tag
        currentIndex++;
        const tagContent = consumeUntil(">");
        const parts = tagContent.split(/\s+/);
        const tagName = parts[0];

        // Check if it's a self-closing tag
        const selfClosing = tagContent.endsWith("/");

        // Extract attributes with better handling of nested braces
        const attrs: Record<string, unknown> = {};
        if (parts.length > 1) {
          const attrString = tagContent.substring(tagName.length).trim();

          // Extract attributes one by one
          let attrIndex = 0;
          while (attrIndex < attrString.length) {
            // Find attribute name
            const nameMatch = /(\w+)\s*=\s*/.exec(
              attrString.substring(attrIndex),
            );

            // If no attribute name match is found, break out of the loop
            if (!nameMatch) {
              // Skip any unmatched characters to prevent infinite loop
              attrIndex++;
              continue;
            }

            const name = nameMatch[1];
            attrIndex += nameMatch[0].length;

            // Safety check: if we've reached the end of the string, break
            if (attrIndex >= attrString.length) break;

            // Handle attribute value
            if (attrString[attrIndex] === "{") {
              // JSX expression with possible nested braces
              let braceCount = 1;
              let valueEnd = attrIndex + 1;

              // Safety check: limit iterations to prevent infinite loop
              const maxIterations = attrString.length;
              let iterations = 0;

              while (
                braceCount > 0 &&
                valueEnd < attrString.length &&
                iterations < maxIterations
              ) {
                if (attrString[valueEnd] === "{") braceCount++;
                if (attrString[valueEnd] === "}") braceCount--;
                valueEnd++;
                iterations++;
              }

              // Handle incomplete expressions
              if (braceCount > 0) {
                // Incomplete expression, just skip it
                attrIndex = valueEnd;
                continue;
              }

              const expr = attrString.substring(attrIndex + 1, valueEnd - 1);

              try {
                // Handle boolean literals and other primitive values
                if (expr === "false") {
                  attrs[name] = false;
                } else if (expr === "true") {
                  attrs[name] = true;
                } else if (expr === "null") {
                  attrs[name] = null;
                } else if (expr === "undefined") {
                  attrs[name] = undefined;
                } else if (!isNaN(Number(expr))) {
                  attrs[name] = Number(expr);
                } else {
                  attrs[name] = `{${expr}}`;
                }
              } catch (error) {
                attrs[name] = `{${expr}}`;
              }

              attrIndex = valueEnd;
            } else if (
              attrString[attrIndex] === '"' ||
              attrString[attrIndex] === "'"
            ) {
              // String literal - handle both single and double quotes
              const quoteChar = attrString[attrIndex];
              const valueEnd = attrString.indexOf(quoteChar, attrIndex + 1);

              // Handle unclosed quotes
              if (valueEnd === -1) {
                // Unclosed quote, just move past this character
                attrIndex++;
                continue;
              }

              attrs[name] = attrString.substring(attrIndex + 1, valueEnd);
              attrIndex = valueEnd + 1;
            } else {
              // Invalid attribute format, skip this character
              attrIndex++;
            }

            // Skip whitespace
            while (
              attrIndex < attrString.length &&
              /\s/.test(attrString[attrIndex])
            ) {
              attrIndex++;
            }
          }
        }

        tokens.push({
          type: "openTag",
          tagName: tagName.replace("/", ""),
          attrs,
          selfClosing,
        });

        currentIndex++; // Skip '>'
      }
    } else if (char === "{") {
      // JSX expression
      currentIndex++;
      const expr = consumeUntil("}");
      tokens.push({ type: "expression", value: expr });
      currentIndex++; // Skip '}'
    } else {
      // Text content
      let text = "";
      while (
        currentIndex < jsxString.length &&
        jsxString[currentIndex] !== "<" &&
        jsxString[currentIndex] !== "{"
      ) {
        text += jsxString[currentIndex];
        currentIndex++;
      }

      if (text.trim()) {
        tokens.push({ type: "text", value: text.trim() });
      }
    }
  }

  // Build the element tree - modified to handle multiple root elements
  function buildTree(): TreeNode[] {
    const rootNodes: TreeNode[] = [];
    const stack: TreeNode[] = [];

    for (const token of tokens) {
      if (token.type === "openTag" && token.tagName) {
        const element: TreeNode = {
          type: token.tagName,
          props: token.attrs || {},
          children: [],
        };

        if (stack.length === 0) {
          // This is a root node
          rootNodes.push(element);
        } else {
          // Add as child of current parent
          stack[stack.length - 1].children.push(element);
        }

        if (!token.selfClosing) {
          stack.push(element);
        }
      } else if (token.type === "closeTag") {
        stack.pop();
      } else if (token.type === "text" || token.type === "expression") {
        if (token.value) {
          const node = {
            type: token.type,
            value: token.value,
            children: [],
          };

          if (stack.length > 0) {
            stack[stack.length - 1].children.push(node);
          } else {
            // Text at root level
            rootNodes.push(node);
          }
        }
      }
    }

    return rootNodes;
  }

  // Convert the tree to React.createElement calls
  function treeToReactElements(
    node: TreeNode | string | undefined,
    components: Record<string, React.ComponentType<ComponentProps>>,
  ): React.ReactNode {
    if (!node) return null;

    if (typeof node === "string") {
      return node;
    }

    if (node.type === "text" && node.value) {
      return node.value;
    }

    if (node.type === "expression" && node.value) {
      // In a real implementation, you'd evaluate expressions safely
      return node.value;
    }

    if (typeof node.type !== "string") {
      return null;
    }

    // Component or HTML element
    const isComponent = /^[A-Z]/.test(node.type);

    // Type-safe approach for accessing components
    const elementType = isComponent
      ? (
        components as unknown as Record<
          string,
          React.ComponentType<ComponentProps>
        >
      )[node.type] ?? "div"
      : node.type;

    // Process children recursively
    const children: React.ReactNode[] = node.children.map((child) =>
      treeToReactElements(child, components),
    );

    // Add special handling for style props before creating the element
    if (typeof node.type === "string" && node.props) {
      // Fix style prop if it's a string or not properly formatted
      if (node.props.style && typeof node.props.style === "string") {
        const originalStyleString = node.props.style;
        let parsedStyle = {};
        let parseSuccess = false;

        console.log("node.props.style", node.props.style);

        // Strategy 1: Try JSON.parse for valid JSON strings
        try {
          parsedStyle = JSON.parse(originalStyleString);
          parseSuccess = true;
        } catch {
          // JSON.parse failed, continue to next strategy
        }

        // Strategy 2: Handle JSX style syntax like {color: "red"} or {{color: "red"}}
        if (!parseSuccess && originalStyleString.startsWith("{")) {
          try {
            // Handle double braces case
            let styleStr = originalStyleString;
            if (styleStr.startsWith("{{") && styleStr.endsWith("}}")) {
              styleStr = styleStr.substring(1, styleStr.length - 1);
            }

            // Remove outer braces and trailing semicolon if present
            styleStr = styleStr.replace(/^\{|\}$/g, "").replace(/;$/, "");

            // Parse using regex instead of naive splitting
            const styleObj: Record<string, string> = {};
            const propertyRegex = /([a-zA-Z-]+)\s*:\s*([^;,]+)(?:,|$)/g;
            let match;

            while ((match = propertyRegex.exec(styleStr)) !== null) {
              const [, key, value] = match;
              if (key && value) {
                styleObj[key.trim()] = value.trim();
              }
            }

            if (Object.keys(styleObj).length > 0) {
              parsedStyle = styleObj;
              parseSuccess = true;
            }
          } catch (error) {
            console.error("Error parsing style string:", error);
          }
        }

        // Strategy 3: Try evaluating as JavaScript (for more complex expressions)
        if (
          !parseSuccess &&
          originalStyleString.startsWith("{") &&
          originalStyleString.endsWith("}")
        ) {
          try {
            const styleString = `(${originalStyleString})`;
            parsedStyle = new Function(`return ${styleString}`)();
            parseSuccess = true;
          } catch (error) {
            console.error("Error evaluating style object:", error);
            // All strategies failed
          }
        }

        console.log("parsedStyle", parsedStyle);

        // Apply the parsed style (or empty object if all strategies failed)
        node.props.style = parseSuccess ? parsedStyle : {};
      }

      // Special handling for sx prop
      if (node.props.sx && typeof node.props.sx === "string") {
        try {
          // If sx is a string representation of an object (with or without braces)
          let sxValue = node.props.sx as string;
          if (sxValue.startsWith("{") && sxValue.endsWith("}")) {
            sxValue = sxValue.substring(1, sxValue.length - 1);
          }

          // Convert to a proper object
          const sxObject = new Function(`return (${sxValue})`)();
          node.props.sx = sxObject;
        } catch (error) {
          console.error("Error parsing sx prop:", error);
        }
      }

      // Process attributes/props that contain code to be evaluated
      Object.keys(node.props).forEach((propKey) => {
        if (node.props) {
          const propValue = node.props[propKey];

          // Ensure event handlers (onClick, onChange, etc.) are processed correctly
          if (propKey.startsWith("on") && typeof propValue === "string") {
            try {
              // For string function bodies (without braces)
              if (!propValue.startsWith("{")) {
                node.props[propKey] = function () {
                  try {
                    new Function(propValue)();
                  } catch (error) {
                    console.error("Error executing event handler:", error);
                  }
                };
              }
              // For expressions with braces (from JSX attributes)
              else if (propValue.startsWith("{") && propValue.endsWith("}")) {
                const functionBody = propValue.substring(
                  1,
                  propValue.length - 1,
                );
                node.props[propKey] = function () {
                  try {
                    // For arrow functions, extract and call the function
                    if (functionBody.includes("=>")) {
                      // Get the arrow function without executing its body
                      const arrowFn = new Function("return " + functionBody)();
                      // Call the function when the event occurs
                      arrowFn();
                    } else {
                      // For other expressions, execute the code directly
                      new Function(functionBody)();
                    }
                  } catch (error) {
                    console.error("Error executing event handler:", error);
                  }
                };
              }
            } catch (error) {
              console.error("Error parsing function prop:", error);
            }
          }
        }
      });
    }

    // Create the element
    return React.createElement(
      elementType,
      node.props as React.Attributes & ComponentProps,
      ...children,
    );
  }

  try {
    // Parse and convert
    const rootNodes = buildTree();

    // Handle the different cases
    if (rootNodes.length === 0) {
      return null;
    } else if (rootNodes.length === 1) {
      // Single root element
      return treeToReactElements(rootNodes[0], components) as React.ReactElement;
    } else {
      // Multiple root elements - wrap in Fragment
      return React.createElement(
        React.Fragment,
        null,
        ...rootNodes.map((node) => treeToReactElements(node, components)),
      );
    }
  } catch (error) {
    console.error(
      "Error parsing JSX:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/*
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AccountCircleIcon,
  AccountCircleOutlineIcon,
  AccountGroupOutlineIcon,
  AccountIcon,
  AccountMultipleIcon,
  AccountOutlineIcon,
  Alert,
  AlertBoxIcon,
  AlertCircleOutlineIcon,
  AlertIcon,
  AlertOutlineIcon,
  AlertTitle,
  AppBar,
  ArrowDownwardIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpwardIcon,
  AtIcon,
  Autocomplete,
  AutorenewIcon,
  Avatar,
  BackupRestoreIcon,
  Badge,
  BadgeAccountHorizontalIcon,
  BankOutlineIcon,
  BarcodeIcon,
  BarcodeScanIcon,
  BookOpenVariantIcon,
  Box,
  Breadcrumbs,
  Button,
  ButtonGroup,
  CancelIcon,
  Card,
  CardActions,
  CardContent,
  ChartsAxisHighlight,
  ChartsLegend,
  ChartsReferenceLine,
  ChartsTooltip,
  ChartsXAxis,
  ChartsYAxis,
  CheckCircleIcon,
  CheckIcon,
  Checkbox,
  CheckboxMarkedCircleOutlineIcon,
  ChevronDoubleDownIcon,
  ChevronDoubleUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Chip,
  CircleIcon,
  CircularProgress,
  CityIcon,
  ClickAwayListener,
  ClientDataGrid,
  ClipboardCheckOutline,
  ClipboardEditOutline,
  ClockOutlineIcon,
  CloseCircleIcon,
  CloseIcon,
  CogIcon,
  Collapse,
  ContentCopyIcon,
  ContentSaveIcon,
  DataGrid,
  DataGridPremium,
  DataGridPro,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  DeleteIcon,
  DeleteOutlineIcon,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  DomainIcon,
  DotsHorizontalIcon,
  DotsVerticalIcon,
  DragHorizontalIcon,
  DragVerticalIcon,
  EmailIcon,
  EyeIcon,
  Fade,
  FileEyeIcon,
  FileFindOutlineIcon,
  FlagIcon,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  FormatBoldIcon,
  FormatColorFillIcon,
  FormatColumnsIcon,
  FormatItalicIcon,
  FormatListBulletedIcon,
  FormatListNumberedIcon,
  FormatSubscriptIcon,
  FormatSuperscriptIcon,
  ForumIcon,
  Grid,
  Grid2,
  GridActionsCell,
  GridActionsCellItem,
  GridAddIcon,
  GridApiContext,
  GridArrowDownwardIcon,
  GridArrowUpwardIcon,
  GridBody,
  GridBooleanCell,
  GridCell,
  GridCellCheckboxForwardRef,
  GridCellCheckboxRenderer,
  GridCellEditStartReasons,
  GridCellEditStopReasons,
  GridCellModes,
  GridCheckCircleIcon,
  GridCheckIcon,
  GridClearIcon,
  GridCloseIcon,
  GridColumnHeaderFilterIconButton,
  GridColumnHeaderItem,
  GridColumnHeaderMenu,
  GridColumnHeaderSeparator,
  GridColumnHeaderSeparatorSides,
  GridColumnHeaderSortIcon,
  GridColumnHeaderTitle,
  GridColumnHeaders,
  GridColumnIcon,
  GridColumnMenu,
  GridColumnMenuColumnsItem,
  GridColumnMenuContainer,
  GridColumnMenuFilterItem,
  GridColumnMenuHideItem,
  GridColumnMenuManageItem,
  GridColumnMenuPinningItem,
  GridColumnMenuSortItem,
  GridColumnsManagement,
  GridColumnsPanel,
  GridContextProvider,
  GridCsvExportMenuItem,
  GridDataSourceCacheDefault,
  GridDeleteForeverIcon,
  GridDeleteIcon,
  GridDetailPanelToggleCell,
  GridDragIcon,
  GridEditBooleanCell,
  GridEditDateCell,
  GridEditInputCell,
  GridEditModes,
  GridEditSingleSelectCell,
  GridExpandMoreIcon,
  GridFilterAltIcon,
  GridFilterForm,
  GridFilterInputBoolean,
  GridFilterInputDate,
  GridFilterInputMultipleSingleSelect,
  GridFilterInputMultipleValue,
  GridFilterInputSingleSelect,
  GridFilterInputValue,
  GridFilterListIcon,
  GridFilterPanel,
  GridFooter,
  GridFooterContainer,
  GridFooterPlaceholder,
  GridGenericColumnMenu,
  GridHeader,
  GridHeaderCheckbox,
  GridHeaderFilterCell,
  GridHeaderFilterMenu,
  GridHeaderFilterMenuContainer,
  GridKeyboardArrowRight,
  GridLoadIcon,
  GridLoadingOverlay,
  GridLogicOperator,
  GridMenu,
  GridMenuIcon,
  GridMoreVertIcon,
  GridNoRowsOverlay,
  GridOverlay,
  GridOverlays,
  GridPagination,
  GridPanel,
  GridPanelContent,
  GridPanelFooter,
  GridPanelHeader,
  GridPanelWrapper,
  GridPinnedColumnPosition,
  GridPreferencePanelsValue,
  GridPrintExportMenuItem,
  GridPushPinLeftIcon,
  GridPushPinRightIcon,
  GridRemoveIcon,
  GridRoot,
  GridRow,
  GridRowCount,
  GridRowEditStartReasons,
  GridRowEditStopReasons,
  GridRowModes,
  GridRowReorderCell,
  GridSaveAltIcon,
  GridSearchIcon,
  GridSelectedRowCount,
  GridSeparatorIcon,
  GridSignature,
  GridSkeletonCell,
  GridTableRowsIcon,
  GridToolbar,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarExportContainer,
  GridToolbarFilterButton,
  GridToolbarQuickFilter,
  GridTreeDataGroupingCell,
  GridTripleDotsVerticalIcon,
  GridViewColumnIcon,
  GridViewHeadlineIcon,
  GridViewStreamIcon,
  GridVisibilityOffIcon,
  Grow,
  Header,
  HelpCircleIcon,
  HelpCircleOutlineIcon,
  IconButton,
  InformationIcon,
  InformationOutlineIcon,
  InputAdornment,
  InputLabel,
  LineChart,
  LineHighlightPlot,
  LinePlot,
  Link,
  LinkIcon,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  LoadingButton,
  LockOpenOutlineIcon,
  LogoutIcon,
  MagnifyIcon,
  MapMarkerOutlineIcon,
  MarkPlot,
  Menu,
  MenuIcon,
  MenuItem,
  MenuList,
  MenuOpenIcon,
  MessageOutlineIcon,
  MinusCircleOutlineIcon,
  NativeSelect,
  NotificationClearAllIcon,
  OpenInNewIcon,
  OutlinedInput,
  PageFirstIcon,
  PageLastIcon,
  PageNextIcon,
  Pagination,
  PaginationItem,
  Paper,
  PencilIcon,
  PencilOutlineIcon,
  PhoneIcon,
  PlayIcon,
  PlusCircleIcon,
  PlusCircleOutlineIcon,
  PlusIcon,
  Popover,
  Popper,
  PrinterIcon,
  Radio,
  RadioGroup,
  RedoIcon,
  RefreshIcon,
  ReplayIcon,
  ResponsiveChartContainer,
  RestoreIcon,
  RoutesIcon,
  ScopedCssBaseline,
  Select,
  ServerDataGrid,
  ShareOutlineIcon,
  ShuffleVariantIcon,
  Skeleton,
  Slide,
  Snackbar,
  SnackbarContent,
  SnackbarProvider,
  Stack,
  SubdirectoryArrowLeftIcon,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  TimePicker,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  TranslateIcon,
  Typography,
  WorldShareTheme,
  Zoom,
} from "@oclc/ws-styleguide";
*/