import "@/app/globals.css";
import FooterDashboard from "@/components/footer-dashboard";
import NavbarDashboard from "@/components/navbar-dashboard";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div>
            <NavbarDashboard />
            {children}
            <FooterDashboard />
        </div>
    );
}
