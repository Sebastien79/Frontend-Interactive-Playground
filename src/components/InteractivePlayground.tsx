import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { Editor } from "@components/Editor";
import * as muiComponents from "@mui/material";
import { createRoot } from "react-dom/client";
import * as React from "react";
import { parseJSX } from "./Editor/Editor";
import { createContext, useContext, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';

// Create default theme
const defaultTheme = createTheme();

// Create a context for component library
const ComponentLibraryContext = createContext<Record<string, any>>(muiComponents);

// Component library provider
export const ComponentLibraryProvider = ({
  themeType,
  children
}: {
  themeType: "default-theme" | "other-theme",
  children: React.ReactNode
}) => {
  // Select component library based on theme
  // TODO: Add other theme components here
  // TODO: Select other MUI theme
  const componentLibrary = useMemo(() =>
    themeType === "default-theme" ? muiComponents : muiComponents,
    [themeType]);

  return (
    <ComponentLibraryContext.Provider value={componentLibrary}>
      {children}
    </ComponentLibraryContext.Provider>
  );
};

// Hook to use components
export const useComponents = () => useContext(ComponentLibraryContext);

// New Preview component
const Preview = ({ parsedCode, code, themeType }: { parsedCode: React.ReactElement | null, code: string, themeType: "default-theme" | "other-theme" }) => {
  // Get components based on theme
  const components = useComponents();
  // Add state to track the root
  const [dialogRoot, setDialogRoot] = useState<ReturnType<
    typeof createRoot
  > | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Add these states to your Demo component
  const [dialogElement, setDialogElement] = useState<React.ReactElement | null>(
    null,
  );

  // Add this effect to extract and parse Dialog content from code changes
  useEffect(() => {
    try {
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
  }, [dialogElement, isDialogOpen, dialogRoot, themeType]);

  return (
    <components.Box sx={{ p: "8px 12px", bgcolor: "grey.100", minHeight: "fit-content" }}>
      <components.Paper
        elevation={2}
        sx={{ p: 2, bgcolor: "background.default" }}
      >
        {parsedCode}
      </components.Paper>
      <>
        {/* Dynamic Dialog Container */}
        <div id="dynamic-dialog-container"></div>
      </>
    </components.Box>
  );
};

export const CustomThemeProvider = ({ children, theme }: { children: React.ReactNode, theme: string }) => {
  // TODO: Choose other theme
  return (
    theme === "default-theme" && (
      <muiComponents.ThemeProvider theme={defaultTheme}>
        {children}
      </muiComponents.ThemeProvider>
    )
  );
};

// Create a separate component for the theme switcher with routing
function ThemeSwitcher({ themeType, setThemeType }: { themeType: "default-theme" | "other-theme", setThemeType: (themeType: "default-theme" | "other-theme") => void }) {
  // Get components based on theme
  const components = useComponents();
  const location = useLocation();

  // Don't render anything if on preview route
  if (location.pathname === "/preview") {
    return null;
  }

  return (
    <components.Paper
      elevation={2}
      sx={{
        p: "4px 4px",
        m: "8px 8px",
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        bgcolor: "grey.100",
      }}
    >
      <components.FormControl>
        <components.Typography variant="label" sx={{ fontWeight: "bold", pl: 1, fontSize: "0.8rem" }}>Select a theme:</components.Typography>
        <components.RadioGroup
          row
          name="theme-selector"
          value={themeType}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThemeType(e.target.value as "default-theme" | "other-theme")}
        >
          <components.FormControlLabel
            value="default-theme"
            control={<components.Radio size="small" />}
            label={<components.Typography variant="label" sx={{ fontSize: "0.8rem" }}>Default theme</components.Typography>}
          />
          <components.FormControlLabel
            sx={{ display: "none" }}
            value="other-theme"
            control={<components.Radio size="small" />}
            label={<components.Typography variant="label" sx={{ fontSize: "0.8rem" }}>Other theme</components.Typography>}
          />
        </components.RadioGroup>
      </components.FormControl>
    </components.Paper>
  );
}

function InteractivePlayground({
  setThemeType,
  themeType,
  code,
  setCode,
  setParsedCode,
  handleReset,
  parsedCode
}: InteractivePlaygroundProps) {
  // Get components based on theme
  const components = useComponents();

  return (
    <components.ScopedCssBaseline>
      {/* Navigation */}
      <components.AppBar position="static" sx={{ mb: 2, p: "8px 16px" }}>
        <components.Toolbar>
          <img src="cool-logo.png" alt="Live Interactive Playground" width="131" height="32" />
          <components.Typography variant="body1" component="h1" sx={{ m: "auto", color: "white" }}>
            Live Interactive Playground
          </components.Typography>
          <components.Stack direction="row" spacing={2}>
            <Link to="/">
              <components.Button sx={{ fontSize: "0.9rem" }} color="inherit">Editor</components.Button>
            </Link>
            <Link to="/preview">
              <components.Button sx={{ fontSize: "0.9rem" }} color="inherit">Preview</components.Button>
            </Link>
          </components.Stack>
        </components.Toolbar>
      </components.AppBar>

      {/* Theme Switcher */}
      <ThemeSwitcher themeType={themeType} setThemeType={setThemeType} />

      {/* Routes */}
      <Routes>
        <Route path="/" element={
          <Editor code={code} setCode={setCode} onParsedCodeChange={setParsedCode} handleReset={handleReset} themeType={themeType} />
        } />
        <Route path="/preview" element={<Preview parsedCode={parsedCode} code={code} themeType={themeType} />} />
      </Routes>
    </components.ScopedCssBaseline>
  );
}

// Main component
export function InteractivePlaygroundApp() {
  // Query client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 20, // additional requests for 20 seconds return same value
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });

  // Add state for theme type
  const [themeType, setThemeType] = useState<"default-theme" | "other-theme">("default-theme");

  // Move initialCode here
  const initialCode = `<Box id="box-1" sx={{p: 2, mt: 2}}>\n  <Typography id="typo-1" variant="headingMd" component="h1">Component Visualizer</Typography>\n  <Stack id="stack-1" direction="row" spacing={2} mt={2}>\n    <Button id="button-1" variant="contained">Primary</Button>\n    <Button id="button-2" variant="outlined">Secondary</Button>\n  </Stack>\n </Box>`;

  // Move code state here
  const [code, setCode] = useState(initialCode);

  // Reset function to restore initial code
  const handleReset = () => {
    setCode(initialCode);
  };

  // Add state for parsed code
  const [parsedCode, setParsedCode] = useState<React.ReactElement | null>(null);

  return (
    <StrictMode>
      <style>
        {
          `body {
            padding: 0 !important;
            margin: 0 !important;
          }`
        }
      </style>
      <BrowserRouter basename="/playground">
        <QueryClientProvider client={queryClient}>
          <ComponentLibraryProvider themeType={themeType}>
            <CustomThemeProvider theme={themeType}>
              <InteractivePlayground setThemeType={setThemeType} themeType={themeType} code={code} setCode={setCode} setParsedCode={setParsedCode} handleReset={handleReset} parsedCode={parsedCode} />
            </CustomThemeProvider>
          </ComponentLibraryProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

interface InteractivePlaygroundProps {
  setThemeType: (themeType: "default-theme" | "other-theme") => void;
  themeType: "default-theme" | "other-theme";
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
  setParsedCode: (parsedCode: React.ReactElement) => void;
  handleReset: () => void;
  parsedCode: React.ReactElement | null;
}
