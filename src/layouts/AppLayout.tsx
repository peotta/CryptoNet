import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-base font-semibold ${isActive ? 'bg-accent text-accent-ink' : 'hover:bg-surface2'}`;

export function AppLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Pular para o conteúdo
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" className="mr-4 text-xl font-bold">
            CryptoNet Lab
          </NavLink>
          <nav aria-label="Principal" className="flex flex-wrap gap-1">
            <NavLink to="/" end className={link}>
              Início
            </NavLink>
            <NavLink to="/categoria/classica" className={link}>
              Clássica
            </NavLink>
            <NavLink to="/categoria/simetrica" className={link}>
              Simétrica
            </NavLink>
            <NavLink to="/categoria/assimetrica" className={link}>
              Assimétrica
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={theme === 'dark'}
            className="ml-auto min-h-11 rounded-lg border border-line px-4 text-base font-semibold hover:bg-surface2"
          >
            Tema: {theme === 'dark' ? 'escuro' : 'claro'}
          </button>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center font-mono text-base text-muted">
          CryptoNet é um projeto mantido pelo <strong className="font-bold text-ink">Prof. Dr. Laerte Peotta de Melo</strong>, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa.
          Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT). Os laboratórios não devem proteger dados reais.
        </p>
      </footer>
    </div>
  );
}
