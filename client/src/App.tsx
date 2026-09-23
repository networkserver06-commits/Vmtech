import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Collections from "@/pages/Collections";
import Payouts from "@/pages/Payouts";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Documentation from "@/pages/Documentation";
import PaymentLinkCheckout from "@/pages/PaymentLinkCheckout";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import { useLocation } from "wouter";

function SeoMetadata({ pathname }: { pathname: string }) {
  useEffect(() => {
    const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
    const canonicalPath = path === "/developers" || path === "/documentation" ? "/docs" : path;
    const indexable = canonicalPath === "/" || canonicalPath === "/docs";
    const titles: Record<string, string> = {
      "/": "LeeTec M-Pesa API | Lipa na M-Pesa STK Push Integration",
      "/docs": "LeeTec M-Pesa API Documentation",
    };
    document.title = titles[canonicalPath] ?? "LeeTec Engine";
    const robots = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(document.createElement("meta"));
    robots.setAttribute("name", "robots");
    robots.setAttribute("content", indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow");
    const canonical = document.querySelector('link[rel="canonical"]') ?? document.head.appendChild(document.createElement("link"));
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", `https://leetec.online${canonicalPath}`);
  }, [pathname]);
  return null;
}

function Router() {
  const [pathname] = useLocation();
  return (
    <>
      <SeoMetadata pathname={pathname} />
      <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/collections" component={Collections} />
      <Route path="/payouts" component={Payouts} />
      <Route path="/docs" component={Documentation} />
      <Route path="/documentation" component={Documentation} />
      <Route path="/developers" component={Documentation} />
      <Route path="/pay" component={PaymentLinkCheckout} />
      <Route path="/pay/:merchantSlug" component={PaymentLinkCheckout} />
      <Route path="/pay" component={PaymentLinkCheckout} />
      <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
