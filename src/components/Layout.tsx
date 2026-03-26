import { Navbar } from './Navbar';

export const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="container max-w-lg mx-auto px-4 pt-18 pb-20">
      {children}
    </main>
  </div>
);
