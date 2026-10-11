const { useState, useEffect, useRef } = React, DAY = 864e5, d = s => new Date(s + 'T00:00'), iso = x => { const t = new Date(x); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') }, fm = s => s.slice(8) + '/' + s.slice(5, 7);
const TIPO = { mecanica: 'Mecânica', computacao: 'Computação', eletrica: 'Elétrica' }, PC = { P1: 'er', P2: 'wa', P3: 'p3', P4: '' };
const ST = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' };
const P = { dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', projetos: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>', usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 4.5a3.5 3.5 0 010 7M22 20c0-3-1.5-5-4-5.7"/>', estrategia: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', capacitacoes: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' };
Object.assign(P, { checkins: '<path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/>', precificacao: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>', logout: '<path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 8l4 4-4 4M19 12H9"/>', msg: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', list: '<path d="M4 6h16M4 12h16M4 18h10"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', gestao: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>', file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5"/>', download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', open: '<path d="M7 17L17 7M8 7h9v9"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', undo: '<path d="M4 9h11a5 5 0 010 10H9M4 9l4-4M4 9l4 4"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', userx: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-4 3-6 7-6M16 16l5 5M21 16l-5 5"/>', userok: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-4 3-6 7-6M15 18l2.5 2.5L22 16"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>' });
const Ic = ({ k }) => <svg className="i" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: P[k] }} />;
const NAV = [['dashboard', 'Dashboard'], ['projetos', 'Projetos'], ['capacitacoes', 'Capacitações'], ['checkins', 'Check-in semanal'], ['estrategia', 'Visão Estratégica'], ['gestao', 'Gestão'], ['precificacao', 'Simular precificação'], ['usuarios', 'Usuários']];
const BLOQ = ['estrategia', 'usuarios', 'precificacao'];
const nid = a => Math.max(0, ...a.map(x => x.id)) + 1, ini = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
const Av = ({ D, ids }) => <span>{ids.map(i => { const u = D.u.find(x => x.id == i); return <span key={i} className="av" title={u?.nome}>{ini(u?.nome || '?')}</span> })}</span>;
const un = (D, id) => D.u.find(u => u.id == id)?.nome || '—', hj = D => d(D.c.hoje), nm = (D, ids) => (ids || []).map(i => un(D, i)).join(', ') || '—';
const prog = (D, p) => { const t = D.t.filter(x => x.projetoId == p.id); return t.length ? Math.round(t.filter(x => x.status == 'concluida').length / t.length * 100) : 0 };
const semana = D => { const h = hj(D); return iso(+h - ((h.getDay() + 6) % 7) * DAY) }, brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const HUM = ['Difícil', 'Cansativa', 'Ok', 'Boa', 'Ótima'], Hm = ({ n }) => <span className={'chip ' + (n >= 4 ? 'ok' : n == 3 ? '' : n == 2 ? 'wa' : 'er')}>{HUM[n - 1]}</span>;
const Stars = ({ n, set }) => <span className="stars" role={set ? 'radiogroup' : 'img'} aria-label={'Nota ' + n + ' de 5'}>{[1, 2, 3, 4, 5].map(i => set ? <button type="button" key={i} role="radio" aria-checked={n == i} className={'st1' + (i <= n ? ' on' : '')} aria-label={i + ' de 5'} onClick={() => set(i)}><Ic k="star" /></button> : <span key={i} className={'st1' + (i <= n ? ' on' : '')}><Ic k="star" /></span>)}</span>;

function Table({ cols, rows }) {
    const [q, setQ] = useState(''), [s, setS] = useState({ k: null, dir: 1 }), [f, setF] = useState({});
    const val = (r, c) => c.get ? c.get(r) : r[c.k];
    let R = rows.filter(r => cols.every(c => !f[c.k] || String(val(r, c)) == f[c.k]) && (!q || cols.some(c => c.k && String(val(r, c)).toLowerCase().includes(q.toLowerCase()))));
    if (s.k) { const c = cols.find(c => c.k == s.k); R = [...R].sort((a, b) => { const x = val(a, c), y = val(b, c); return (x > y ? 1 : x < y ? -1 : 0) * s.dir }) }
    const sort = c => c.k && setS(o => ({ k: c.k, dir: o.k == c.k ? -o.dir : 1 }));
    return <div><div className="tb"><input placeholder="Buscar…" aria-label="Buscar" value={q} onChange={e => setQ(e.target.value)} />
        {cols.filter(c => c.filter).map(c => <select key={c.k} aria-label={'Filtrar ' + c.l} value={f[c.k] || ''} onChange={e => setF({ ...f, [c.k]: e.target.value })}><option value="">{c.l}: todos</option>{[...new Set(rows.map(r => String(val(r, c))))].sort().map(v => <option key={v}>{v}</option>)}</select>)}</div>
        <div className="tw"><table><thead><tr>{cols.map((c, i) => <th key={i} className={c.k ? '' : 'n'} onClick={() => sort(c)} aria-sort={s.k == c.k ? (s.dir > 0 ? 'ascending' : 'descending') : undefined}>{c.l}{s.k == c.k && c.k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
            <tbody>{R.map(r => <tr key={r.id}>{cols.map((c, i) => <td key={i}>{c.render ? c.render(r) : val(r, c)}</td>)}</tr>)}{!R.length && <tr><td colSpan={cols.length}><small>Nada encontrado. Ajuste a busca ou os filtros.</small></td></tr>}</tbody></table></div></div>
}

function Multi({ opts, value, onChange }) {
    const [o, setO] = useState(false), [q, setQ] = useState(''), ref = useRef(null);
    useEffect(() => { const f = e => ref.current && !ref.current.contains(e.target) && setO(false); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f) }, []);
    const tg = id => onChange(value.includes(id) ? value.filter(i => i != id) : [...value, id]), L = opts.filter(u => u.nome.toLowerCase().includes(q.toLowerCase()));
    return <div className="ms" ref={ref}><div className="mc" onClick={() => setO(true)}>{value.map(i => { const u = opts.find(x => x.id == i); return u && <span className="chip" key={i}>{u.nome} <button type="button" aria-label={'Remover ' + u.nome} onClick={e => { e.stopPropagation(); tg(i) }}>×</button></span> })}
        <input placeholder={value.length ? '' : 'Selecionar…'} value={q} onFocus={() => setO(true)} onChange={e => setQ(e.target.value)} /></div>
        {o && <div className="mp">{L.map(u => <div key={u.id} className={'mo' + (value.includes(u.id) ? ' on' : '')} onClick={() => tg(u.id)}><input type="checkbox" readOnly checked={value.includes(u.id)} />{u.nome}<small>{u.perfil}</small></div>)}{!L.length && <div className="mo"><small>Ninguém encontrado</small></div>}</div>}</div>
}
function Form({ t, fs, init, save, close }) {
    const [v, setV] = useState(init), set = (k, x) => setV(o => ({ ...o, [k]: x }));
    return <div className="ov" onClick={close}><form className="md" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save(v); close() }}><h3>{t}</h3>
        {fs.filter(x => !x.s || x.s(v)).map(x => x.c ? <div className="fl" key={x.k}>{x.l}<Multi opts={x.c} value={v[x.k] || []} onChange={z => set(x.k, z)} /></div> : <label key={x.k}>{x.l}
            {x.o ? <select value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)}>{x.o.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
                : <input type={x.t || 'text'} required value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)} />}</label>)}
        <div className="r"><button type="button" className="g" onClick={close}>Cancelar</button><button>Salvar</button></div></form></div>
}

function Menu({ items }) {
    const [pos, setPos] = useState(null), b = useRef(null), close = () => setPos(null);
    useEffect(() => {
        if (!pos) return; const k = e => e.key == 'Escape' && close();
        addEventListener('keydown', k); addEventListener('scroll', close, true); addEventListener('resize', close);
        return () => { removeEventListener('keydown', k); removeEventListener('scroll', close, true); removeEventListener('resize', close) }
    }, [pos]);
    const open = e => { e.stopPropagation(); if (pos) return close(); const r = b.current.getBoundingClientRect(), up = r.bottom + 70 > innerHeight; setPos({ r: innerWidth - r.right, y: up ? innerHeight - r.top + 6 : r.bottom + 6, up }) };
    return <><button ref={b} className="dots" aria-label="Ações" aria-haspopup="menu" aria-expanded={!!pos} onClick={open}><Ic k="menu" /></button>
        {pos && ReactDOM.createPortal(<><div className="scrim" onClick={e => { e.stopPropagation(); close() }} /><div className={'pop' + (pos.up ? ' up' : '')} role="menu" style={pos.up ? { right: pos.r, bottom: pos.y } : { right: pos.r, top: pos.y }}>{items.map(([k, l, fn, dg], i) => <button key={l} role="menuitem" className={'ib' + (dg ? ' x' : '')} data-tip={l} aria-label={l} style={{ '--d': i * 45 + 'ms' }} onClick={e => { e.stopPropagation(); close(); fn() }}><Ic k={k} /></button>)}</div></>, document.body)}</>
}

function App({ D: DF, setD, me, sair }) {
    const mb = DF.u.find(u => u.id == me)?.perfil == 'membro', D = mb ? { ...DF, priv: true, p: DF.p.filter(p => p.membros.includes(me)), t: DF.t.filter(t => (t.responsaveis || []).includes(me)), i: DF.i.filter(x => x.usuarioId == me), f: DF.f.filter(x => x.usuarioId == me) } : DF, nav = NAV.filter(([k]) => !mb || !BLOQ.includes(k));
    const [pg, setPg] = useState({ n: 'dashboard' }), [md, setMd] = useState(null), [dk, setDk] = useState(document.documentElement.dataset.theme == 'dark');
    const tema = () => { const n = !dk, r = document.documentElement; r.classList.add('tt'); r.dataset.theme = n ? 'dark' : 'light'; try { localStorage.setItem('tema', n ? 'dark' : 'light') } catch (e) { } setDk(n); setTimeout(() => r.classList.remove('tt'), 600) };
    const up = (k, fn) => setD(s => ({ ...s, [k]: fn(s[k]) })), form = (t, fs, init, save) => setMd({ t, fs, init, save }), go = (n, pid) => { setPg({ n: mb && BLOQ.includes(n) ? 'dashboard' : n, pid }); scrollTo(0, 0) };
    const pr = { D, up, form, go, me, nav }, V = { dashboard: Dash, projetos: Projetos, projeto: Projeto, usuarios: Usuarios, estrategia: Estrategia, capacitacoes: Cap, gestao: Gestao, precificacao: Preco, checkins: Checkins }[pg.n == 'projeto' && !D.p.find(x => x.id == pg.pid) ? 'projetos' : pg.n];
    return <><header className="hd"><div className="hdi"><img className="hl" src="assets/logo-branca.png" alt="Konvex Jr – ir para o Dashboard" onClick={() => go('dashboard')} /><div className="hr"><span className="chip hdt">Hoje · {fm(D.c.hoje)}</span><button className="tg" aria-label={dk ? 'Ativar modo claro' : 'Ativar modo escuro'} title={dk ? 'Modo claro' : 'Modo escuro'} onClick={tema}><span className="sun"><Ic k="sun" /></span><span className="moon"><Ic k="moon" /></span></button><span className="hu"><b>{un(D, me)}</b><small>{D.u.find(u => u.id == me)?.perfil}</small></span><span className="av" title={un(D, me)}>{ini(un(D, me))}</span><button className="g s" onClick={sair}><Ic k="logout" />Sair</button></div></div></header><nav id="menu" aria-label="Menu principal" style={{ '--i': nav.findIndex(([k]) => k == (pg.n == 'projeto' ? 'projetos' : pg.n)) }}><i className="pill" />{nav.map(([k, l]) => { const on = pg.n == k || (pg.n == 'projeto' && k == 'projetos'); return <a key={k} role="button" tabIndex={0} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={l} data-l={l} onClick={() => go(k)} onKeyDown={e => e.key == 'Enter' && go(k)}><Ic k={k} /></a> })}</nav>
        <main><div key={pg.n + '-' + (pg.pid || '')} className="pgt"><V {...pr} pid={pg.pid} /></div></main>{md && <Form {...md} close={() => setMd(null)} />}</>
}

function Burn({ D }) {
    const T = D.t, n = T.length, a = Math.min(...T.map(t => +d(t.inicio))), z = Math.max(...T.map(t => +d(t.fim))), N = Math.round((z - a) / DAY), W = 600, H = 210, X = i => 40 + i / N * (W - 60), Y = v => 10 + (1 - v / n) * (H - 40), pts = [];
    for (let i = 0; i <= N && a + i * DAY <= +hj(D); i++) { const dt = a + i * DAY; pts.push(X(i) + ',' + Y(n - T.filter(t => t.conclusao && +d(t.conclusao) <= dt).length)) }
    return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Burndown"><line x1="40" y1={Y(0)} x2={W - 20} y2={Y(0)} className="ax" /><line x1="40" y1="10" x2="40" y2={Y(0)} className="ax" />
        <text x="4" y="18" fontSize="11" className="mu">{n}</text><text x="28" y={Y(0) + 4} fontSize="11" className="mu">0</text>
        <line x1={X(0)} y1={Y(n)} x2={X(N)} y2={Y(0)} className="id" strokeDasharray="5 4" /><polyline points={pts.join(' ')} fill="none" className="rl" strokeWidth="3" strokeLinejoin="round" />
        <text x="40" y={H - 8} fontSize="11" className="mu">{fm(iso(new Date(a)))}</text><text x={W - 50} y={H - 8} fontSize="11" className="mu">{fm(iso(new Date(z)))}</text>
        <text x={W - 170} y="24" fontSize="12" className="tl">— Restante real</text><text x={W - 170} y="40" fontSize="12" className="mu">-- Ideal</text></svg>
}
function Agenda({ D, me, go }) {
    const h = hj(D), tk = D.t.filter(t => t.status != 'concluida' && t.responsaveis.includes(me)).sort((a, b) => a.fim > b.fim ? 1 : -1).slice(0, 6), ck = D.k.filter(c => c.inscritos.includes(me) && c.data >= D.c.hoje).sort((a, b) => a.data > b.data ? 1 : -1).slice(0, 6);
    return <><div className="card"><h2>Minhas tarefas</h2>{tk.length ? tk.map(t => { const lt = d(t.fim) < h; return <div className="ag" key={t.id} onClick={() => go('projeto', t.projetoId)}><span className={'chip ' + PC[t.prioridade]}>{t.prioridade}</span><div><b>{t.titulo}</b><small>{D.p.find(p => p.id == t.projetoId)?.nome}{lt ? ' · atrasada' : ''}</small></div><span className={'chip ' + (lt ? 'er' : '')}>{fm(t.fim)}</span></div> }) : <small>Você não tem tarefas abertas.</small>}</div>
        <div className="card"><h2>Minhas capacitações</h2>{ck.length ? ck.map(c => <div className="ag" key={c.id} onClick={() => go('capacitacoes')}><span className="chip">{TIPO[c.tipo]}</span><div><b>{c.titulo}</b><small>{c.sala} · {c.hora}</small></div><span className="chip">{fm(c.data)}</span></div>) : <div><small>Você não está inscrito em nenhuma capacitação futura.</small><div className="act"><button className="g s" onClick={() => go('capacitacoes')}>Ver capacitações</button></div></div>}</div></>
}
function Dash({ D, up, go, me, nav }) {
    const mine = D.t.filter(t => (t.responsaveis || []).includes(me)), ab = mine.filter(t => t.status != 'concluida'), lt = ab.filter(t => d(t.fim) < hj(D)).length, cap = D.k.filter(c => c.inscritos.includes(me) && c.data >= D.c.hoje).length;
    return <><section className="hero"><div><h1>Olá, {un(D, me).split(' ')[0]}.</h1><p>{d(D.c.hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}. Vamos organizar a semana?</p><div className="act" style={{ marginTop: 18 }}><button onClick={() => go('projetos')}>Ver projetos</button><button className="ol" onClick={() => go('checkins')}>Fazer check-in</button></div></div>
        <div className="hs">{[[ab.length, 'tarefas abertas'], [lt, 'atrasadas'], [cap, 'capacitações a caminho']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div></section>
        <div className="two"><div className="card"><h2>Burndown de tarefas</h2>{D.t.length ? <Burn D={D} /> : <small>Você ainda não tem tarefas atribuídas.</small>}</div><div className="card"><h2>Resumo das minhas tarefas</h2>{mine.length ? <>{Object.keys(ST).map(k => { const n = mine.filter(t => t.status == k).length; return <div key={k}><div className="bar" style={{ margin: 0 }}><span>{ST[k]}</span><b>{n}</b></div><div className="pg"><i style={{ width: n / mine.length * 100 + '%' }} /></div></div> })}<small>{mine.length} {mine.length == 1 ? 'tarefa atribuída' : 'tarefas atribuídas'} a você</small></> : <small>Você não tem tarefas atribuídas.</small>}</div></div>
        <div className="g2"><Agenda D={D} me={me} go={go} /></div>
        <h2>Atalhos</h2><div className="grid">{nav.slice(1).map(([k, l]) => <button key={k} className="g" style={{ padding: 16, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', borderRadius: 16 }} onClick={() => go(k)}><Ic k={k} />{l}</button>)}</div></>
}

function Usuarios({ D, up, form }) {
    const edit = u => form(u ? 'Editar usuário' : 'Novo usuário', [{ k: 'nome', l: 'Nome' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'perfil', l: 'Perfil', o: D.c.perfis.map(p => [p, p]) }, { k: 'senioridade', l: 'Senioridade', o: Object.entries(D.c.senioridades), s: v => v.perfil == 'membro' }], u || { perfil: 'membro', senioridade: 'junior' }, o => { const q = { ...o, senioridade: o.perfil == 'membro' ? o.senioridade || 'junior' : undefined }; up('u', a => u ? a.map(x => x.id == u.id ? { ...x, ...q } : x) : [...a, { id: nid(a), ativo: true, ...q }]) });
    const set = (u, o) => up('u', a => a.map(x => x.id == u.id ? { ...x, ...o } : x));
    const cols = [{ k: 'nome', l: 'Nome' }, { k: 'email', l: 'E-mail' }, { k: 'perfil', l: 'Perfil', filter: 1, render: u => <select style={{ margin: 0, width: 'auto' }} aria-label={'Perfil de ' + u.nome} value={u.perfil} onChange={e => set(u, { perfil: e.target.value })}>{D.c.perfis.map(p => <option key={p}>{p}</option>)}</select> },
    { k: 'sn', l: 'Senioridade', filter: 1, get: u => u.perfil == 'membro' ? D.c.senioridades[u.senioridade] || '—' : '—', render: u => u.perfil == 'membro' ? <select style={{ margin: 0, width: 'auto' }} aria-label={'Senioridade de ' + u.nome} value={u.senioridade || 'junior'} onChange={e => set(u, { senioridade: e.target.value })}>{Object.entries(D.c.senioridades).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select> : <small>—</small> },
    { k: 'st', l: 'Status', filter: 1, get: u => u.ativo ? 'Ativo' : 'Inativo', render: u => <span className={'chip ' + (u.ativo ? 'ok' : 'er')}>{u.ativo ? 'Ativo' : 'Inativo'}</span> },
    { l: 'Ações', render: u => <div className="act"><button className="g s" onClick={() => edit(u)}>Editar</button><button className={'g s ' + (u.ativo ? 'x' : '')} onClick={() => set(u, { ativo: !u.ativo })}>{u.ativo ? 'Inativar' : 'Reativar'}</button></div> }];
    return <><div className="bar"><h1>Usuários</h1><button onClick={() => edit()}><Ic k="plus" />Novo usuário</button></div><Table cols={cols} rows={D.u} /></>
}

function Projetos({ D, up, form, go }) {
    const [pv, setPv] = useState('grid'), ok = p => p.status == 'concluido';
    const edit = p => form(p ? 'Editar projeto' : 'Novo projeto', [{ k: 'nome', l: 'Nome' }, { k: 'descricao', l: 'Descrição' }, { k: 'inicio', l: 'Início', t: 'date' }, { k: 'fim', l: 'Fim', t: 'date' }, { k: 'membros', l: 'Membros', c: D.u.filter(u => u.ativo) }], p || { membros: [] }, o => up('p', a => p ? a.map(x => x.id == p.id ? { ...x, ...o } : x) : [...a, { id: nid(a), status: 'em_execucao', ...o }]));
    const toggle = p => up('p', a => a.map(x => x.id == p.id ? { ...x, status: ok(p) ? 'em_execucao' : 'concluido' } : x));
    const del = p => confirm('Excluir este projeto e suas tarefas?') && (up('p', a => a.filter(x => x.id != p.id)), up('t', a => a.filter(x => x.projetoId != p.id)));
    const Ac = ({ p }) => <Menu items={D.priv ? [['open', 'Abrir', () => go('projeto', p.id)]] : [['open', 'Abrir', () => go('projeto', p.id)], ['edit', 'Editar', () => edit(p)], [ok(p) ? 'undo' : 'check', ok(p) ? 'Reabrir' : 'Concluir', () => toggle(p)], ['trash', 'Excluir', () => del(p), 1]]} />;
    const Ch = ({ p }) => <span className={'chip ' + (ok(p) ? 'ok' : '')}>{ok(p) ? 'Concluído' : 'Em execução'}</span>;
    const cols = [{ k: 'nome', l: 'Projeto' }, { k: 'st', l: 'Status', filter: 1, get: p => ok(p) ? 'Concluído' : 'Em execução', render: p => <Ch p={p} /> }, { k: 'fim', l: 'Período', render: p => fm(p.inicio) + ' a ' + fm(p.fim) }, { k: 'pr', l: 'Progresso', get: p => prog(D, p), render: p => prog(D, p) + '%' }, { l: 'Membros', render: p => <Av D={D} ids={p.membros} /> }, { l: 'Ações', render: p => <Ac p={p} /> }];
    return <><div className="bar"><h1>Projetos</h1><div><button className={'g ' + (pv == 'grid' ? 'on' : '')} onClick={() => setPv('grid')}>Grid</button><button className={'g ' + (pv == 'lista' ? 'on' : '')} onClick={() => setPv('lista')}>Linhas</button>{!D.priv && <button onClick={() => edit()}><Ic k="plus" />Novo projeto</button>}</div></div>
        {pv == 'grid' ? <div className="grid">{D.p.map(p => <div className="card pj" key={p.id} onClick={() => go('projeto', p.id)}><div className="bar" style={{ margin: 0 }}><Ch p={p} /><Av D={D} ids={p.membros} /></div><h2 style={{ marginTop: 12 }}>{p.nome}</h2><p className="sub" style={{ margin: 0 }}>{p.descricao}</p><div className="pg"><i style={{ width: prog(D, p) + '%' }} /></div><small>{prog(D, p)}% · {fm(p.inicio)} a {fm(p.fim)}</small><span className="cm"><Ac p={p} /></span></div>)}</div> : <Table cols={cols} rows={D.p} />}</>
}

function Projeto({ D, up, form, go, pid, me }) {
    const [pt, setPt] = useState('kanban'), p = D.p.find(x => x.id == pid), T = D.t.filter(t => t.projetoId == pid), h = hj(D);
    const add = i => form('Nova tarefa', [{ k: 'titulo', l: 'Título' }, { k: 'prioridade', l: 'Prioridade', o: ['P1', 'P2', 'P3', 'P4'].map(x => [x, x]) }, { k: 'responsaveis', l: 'Responsáveis', c: D.u.filter(u => p.membros.includes(u.id)) }, { k: 'inicio', l: 'Início', t: 'date' }, { k: 'fim', l: 'Fim', t: 'date' }], { prioridade: 'P3', responsaveis: D.priv ? [me] : [], ...(typeof i == 'number' && i < 3 ? { inicio: D.c.hoje, fim: iso(m + (7 * i + 4) * DAY) } : {}) }, o => up('t', a => [...a, { id: nid(a), projetoId: pid, status: 'pendente', ...o }]));
    const tog = t => up('t', a => a.map(x => x.id == t.id ? { ...x, status: x.status == 'concluida' ? 'andamento' : 'concluida', conclusao: x.status == 'concluida' ? undefined : D.c.hoje } : x));
    const m = +h - ((h.getDay() + 6) % 7) * DAY, col = t => t.status == 'concluida' ? 3 : Math.min(2, Math.max(0, Math.floor((+d(t.fim) - m) / (7 * DAY))));
    const dg = useRef(null), [ov, setOv] = useState(null), [tk, setTk] = useState(null);
    const delT = id => up('t', a => a.filter(x => x.id != id).map(x => x.dependeDe == id ? { ...x, dependeDe: undefined } : x));
    const drop = (t, i) => up('t', a => a.map(x => {
        if (x.id != t.id) return x; if (i == 3) return x.status == 'concluida' ? x : { ...x, status: 'concluida', conclusao: D.c.hoje };
        const was = x.status == 'concluida'; if (!was && col(x) == i) return x; const mon = m + 7 * i * DAY, fim = iso(mon + 4 * DAY), o = { ...x, status: was ? 'andamento' : x.status, conclusao: undefined, fim }; if (x.inicio > fim) o.inicio = iso(mon); return o
    }));
    const a = Math.min(...T.map(t => +d(t.inicio))), z = Math.max(...T.map(t => +d(t.fim))) + DAY, L = z - a, pc = x => (x - a) / L * 100, hp = pc(+h);
    return <><div className="bar"><div><button className="g" onClick={() => go('projetos')}><Ic k="back" />Voltar</button><h1>{p.nome}</h1></div><div><button className={'g ' + (pt == 'kanban' ? 'on' : '')} onClick={() => setPt('kanban')}>Kanban</button><button className={'g ' + (pt == 'gantt' ? 'on' : '')} onClick={() => setPt('gantt')}>Cronograma</button><button onClick={add}><Ic k="plus" />Nova tarefa</button></div></div>
        {pt == 'kanban' ? <div className="kb pgt">{['Essa semana', 'Semana que vem', 'Daqui a duas semanas', 'Concluído'].map((c, i) => {
            const l = T.filter(t => col(t) == i).sort((a, b) => a.prioridade > b.prioridade ? 1 : a.prioridade < b.prioridade ? -1 : a.fim > b.fim ? 1 : -1); return <div className={'col' + (ov === i ? ' dz' : '')} key={c} onDragOver={e => { e.preventDefault(); setOv(i) }} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOv(null)} onDrop={e => { e.preventDefault(); setOv(null); dg.current && drop(dg.current, i); dg.current = null }}><h3>{c}<span className="chip">{l.length}</span></h3>
                {l.map(t => { const lt = t.status != 'concluida' && d(t.fim) < h, dn = t.status == 'concluida'; return <div key={t.id} draggable onDragStart={e => { dg.current = t; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(t.id)) }} onDragEnd={() => { dg.current = null; setOv(null) }} className="tk" onClick={() => setTk(t.id)}><span className={'chip ' + PC[t.prioridade]}>{t.prioridade}</span><b>{t.titulo}</b><div className="tkf"><span className="bds"><span className={'bd ' + (dn ? 'ok' : lt ? 'er' : '')} title={dn ? 'Concluída' : lt ? 'Atrasada' : 'Prazo'}><Ic k="clock" />{fm(dn && t.conclusao ? t.conclusao : t.fim)}</span>{(t.checklist || []).length > 0 && <span className={'bd ' + (t.checklist.every(x => x.feito) ? 'ok' : '')}><Ic k="check" />{t.checklist.filter(x => x.feito).length}/{t.checklist.length}</span>}{t.dependeDe && <span className="bd" title="Depende de outra tarefa"><Ic k="link" /></span>}{t.descricao && <span className="bd" title="Tem descrição"><Ic k="list" /></span>}</span><Av D={D} ids={t.responsaveis} /></div><span className="cm t"><Menu items={[[dn ? 'undo' : 'check', dn ? 'Reabrir' : 'Concluir', () => tog(t)], ['trash', 'Excluir', () => delT(t.id), 1]]} /></span></div> })}
                {i < 3 && <button className="g addc" onClick={() => add(i)}><Ic k="plus" />Adicionar tarefa</button>}</div>
        })}</div>
            : !T.length ? <div className="card">Nenhuma tarefa ainda. Use “Nova tarefa”.</div> : <div className="card gt pgt">{T.map(t => { const dep = T.find(x => x.id == t.dependeDe), x1 = dep && pc(+d(dep.fim) + DAY), x2 = dep && pc(+d(t.inicio)); return <div className="gr" key={t.id}><div className="gl">{t.titulo}<br /><small style={{ fontWeight: 400 }}>{nm(D, t.responsaveis)}</small>{dep && <small className="gdl" title={'Depende de ' + dep.titulo}><Ic k="link" />depende de {dep.titulo}</small>}</div><div className="gc">{hp >= 0 && hp <= 100 && <i className="hj" style={{ left: hp + '%' }} />}{dep && <><i className="gdp" style={{ left: x1 + '%' }} /><i className={'gdd' + (x2 < x1 ? ' bad' : '')} style={{ left: Math.min(x1, x2) + '%', width: Math.abs(x2 - x1) + '%' }} /></>}<div className={'gb ' + (t.status == 'concluida' ? 'c' : t.status == 'pendente' ? 'p' : '')} title={fm(t.inicio) + ' a ' + fm(t.fim)} style={{ left: pc(+d(t.inicio)) + '%', width: (+d(t.fim) + DAY - +d(t.inicio)) / L * 100 + '%' }} /></div></div> })}<small>Vermelho: hoje · Verde: concluída · Teal: em andamento · Âmbar: pendente · Linha tracejada: dependência entre tarefas</small></div>}{tk && T.find(x => x.id == tk) && <TaskModal D={D} up={up} t={T.find(x => x.id == tk)} p={p} T={T} close={() => setTk(null)} del={delT} />}</>
}

function TaskModal({ D, up, t, p, T, close, del }) {
    const [nv, setNv] = useState(''), cl = t.checklist || [], dn = cl.filter(x => x.feito).length;
    const patch = o => up('t', a => a.map(x => x.id == t.id ? { ...x, ...o } : x)), setCl = f => patch({ checklist: f(cl) });
    const st = v => patch({ status: v, conclusao: v == 'concluida' ? D.c.hoje : undefined });
    const chain = id => { const o = []; let x = T.find(y => y.id == id); while (x && !o.includes(x.id)) { o.push(x.id); x = T.find(y => y.id == x.dependeDe) } return o };
    const opts = T.filter(c => c.id != t.id && !chain(c.id).includes(t.id)), deps = T.filter(x => x.dependeDe == t.id);
    const addI = () => { const v = nv.trim(); if (!v) return; setCl(a => [...a, { id: Math.max(0, ...a.map(x => x.id)) + 1, texto: v, feito: false }]); setNv('') };
    useEffect(() => { const k = e => e.key == 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, []);
    return <div className="ov" onClick={close}><div className="md wide" role="dialog" aria-label="Detalhes da tarefa" onClick={e => e.stopPropagation()}>
        <input className="tt0" aria-label="Título da tarefa" value={t.titulo} onChange={e => patch({ titulo: e.target.value })} /><small>em {p.nome}</small>
        <div className="tcols"><div>
            <h4><Ic k="list" />Descrição</h4><textarea aria-label="Descrição" placeholder="Adicione uma descrição mais detalhada…" value={t.descricao || ''} onChange={e => patch({ descricao: e.target.value })} />
            <h4><Ic k="check" />Checklist{cl.length > 0 && <span className="chip">{dn}/{cl.length}</span>}</h4>
            {cl.length > 0 && <div className="pg"><i className={dn == cl.length ? 'ok' : ''} style={{ width: dn / cl.length * 100 + '%' }} /></div>}
            {cl.map(x => <div className="ci2" key={x.id}><label className="ck"><input type="checkbox" checked={x.feito} onChange={() => setCl(a => a.map(y => y.id == x.id ? { ...y, feito: !y.feito } : y))} /><span className={x.feito ? 'dn' : ''}>{x.texto}</span></label><button className="dots" aria-label="Remover item" onClick={() => setCl(a => a.filter(y => y.id != x.id))}><Ic k="x" /></button></div>)}
            <div className="addi"><input placeholder="Adicionar item" aria-label="Novo item do checklist" value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => e.key == 'Enter' && addI()} /><button className="g" onClick={addI}>Adicionar</button></div></div>
            <div><label>Situação<select value={t.status} onChange={e => st(e.target.value)}>{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label>Prioridade<select value={t.prioridade} onChange={e => patch({ prioridade: e.target.value })}>{['P1', 'P2', 'P3', 'P4'].map(x => <option key={x}>{x}</option>)}</select></label>
                <label>Início<input type="date" value={t.inicio} onChange={e => patch({ inicio: e.target.value })} /></label>
                <label>Fim<input type="date" value={t.fim} onChange={e => patch({ fim: e.target.value })} /></label>
                <div className="fl">Responsáveis<Multi opts={D.u.filter(u => p.membros.includes(u.id))} value={t.responsaveis || []} onChange={z => patch({ responsaveis: z })} /></div>
                <label>Depende de<select value={t.dependeDe || ''} onChange={e => patch({ dependeDe: e.target.value ? +e.target.value : undefined })}><option value="">Nenhuma</option>{opts.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label>
                {deps.length > 0 && <div className="fl">Tarefas que dependem desta{deps.map(x => <span key={x.id} className="chip" style={{ display: 'block', marginTop: 6, whiteSpace: 'normal' }}>{x.titulo}</span>)}</div>}</div></div>
        <div className="r" style={{ marginTop: 18 }}><button className="g x" onClick={() => confirm('Excluir esta tarefa?') && (del(t.id), close())}><Ic k="trash" />Excluir tarefa</button><button onClick={close}>Fechar</button></div></div></div>
}

function Estrategia({ D, go }) {
    const T = D.t, h = hj(D), ativos = D.u.filter(u => u.ativo), [tab, setTab] = useState('late');
    const late = t => t.status != 'concluida' && d(t.fim) < h, pn = id => D.p.find(p => p.id == id)?.nome;
    const G = { late: T.filter(late), and: T.filter(t => t.status != 'concluida' && !late(t)), done: T.filter(t => t.status == 'concluida') };
    const TB = { late: ['Atrasadas', 'er'], and: ['Em andamento', 'an'], done: ['Concluídas', 'ok'] };
    const crit = D.p.filter(p => p.status == 'em_execucao').map(p => {
        const n = G.late.filter(t => t.projetoId == p.id).length, left = Math.round((+d(p.fim) - +h) / DAY), pr = prog(D, p), r = [];
        if (n) r.push(n + (n == 1 ? ' tarefa atrasada' : ' tarefas atrasadas'));
        if (left < 0) r.push('Prazo vencido há ' + -left + (left == -1 ? ' dia' : ' dias')); else if (left <= 14 && pr < 70) r.push('Prazo em ' + left + (left == 1 ? ' dia' : ' dias') + ' com ' + pr + '% concluído');
        return { p, r, sc: n * 10 + (left < 0 ? 100 : 0) + Math.max(0, 14 - left), pr }
    }).filter(x => x.r.length).sort((a, b) => b.sc - a.sc);
    const part = ativos.map(u => ({ id: u.id, nome: u.nome, ks: D.k.filter(k => k.inscritos.includes(u.id)) })), com = part.filter(x => x.ks.length), sem = part.filter(x => !x.ks.length);
    const ccols = [{ k: 'nome', l: 'Membro' }, { k: 'n', l: 'Capacitações', get: x => x.ks.length, render: x => x.ks.length }, { l: 'Quais', render: x => x.ks.map(k => <span key={k.id} className={'chip tp-' + k.tipo} style={{ marginRight: 6, display: 'inline-block' }}>{k.titulo}</span>) }];
    const rk = ativos.filter(u => u.perfil == 'membro').map(u => { const c = T.filter(t => t.status == 'concluida' && t.responsaveis.includes(u.id)); return { u, n: c.length, np: c.filter(t => t.conclusao <= t.fim).length } }).sort((a, b) => b.n - a.n || b.np - a.np), top = rk[0]?.n ? rk[0] : null, mx = Math.max(1, ...rk.slice(0, 3).map(r => r.n));
    return <><div className="bar"><div style={{ display: 'block' }}><h1>Visão Estratégica</h1><p className="sub" style={{ margin: 0 }}>Panorama de tarefas, projetos, capacitações e pessoas em {fm(D.c.hoje)}</p></div></div>
        <div className="stats"><div className="card"><b>{T.length}</b><span>Tarefas no total</span></div>{Object.keys(TB).map(k => <div className="card" key={k}><b>{G[k].length}</b><span><i className={'dt ' + TB[k][1]} />{TB[k][0]}</span></div>)}</div>
        <div className="two"><div className="card"><h2>Burndown de tarefas</h2><Burn D={D} /></div>
            <div className="card"><h2>Relação de tarefas</h2><div className="bar" style={{ marginBottom: 8 }}><div>{Object.keys(TB).map(k => <button key={k} className={'g s ' + (tab == k ? 'on' : '')} onClick={() => setTab(k)}>{TB[k][0]}</button>)}</div></div>
                <div className="lst">{G[tab].length ? G[tab].map(t => <div className="ag" key={t.id} onClick={() => go('projeto', t.projetoId)}><span className={'chip ' + PC[t.prioridade]}>{t.prioridade}</span><div><b>{t.titulo}</b><small>{pn(t.projetoId)} · {nm(D, t.responsaveis)}</small></div><span className="chip">{fm(tab == 'done' ? t.conclusao : t.fim)}</span></div>) : <small>Nenhuma tarefa nesta situação.</small>}</div></div></div>
        <div className="sec"><h2>Projetos</h2></div>
        <div className="two"><div className="card"><h2>Tarefas por projeto</h2>{D.p.map(p => { const L = T.filter(t => t.projetoId == p.id), c = L.filter(t => t.status == 'concluida').length, a = L.filter(late).length, n = L.length || 1; return <div key={p.id}><div className="bar" style={{ margin: 0 }}><span>{p.nome}</span><b>{L.length}</b></div><div className="pg"><i className="ok" style={{ width: c / n * 100 + '%' }} /><i style={{ width: (L.length - c - a) / n * 100 + '%', opacity: .45 }} /><i className="er" style={{ width: a / n * 100 + '%' }} /></div><small>{c} concluídas · {L.length - c - a} em andamento · {a} atrasadas</small></div> })}</div>
            <div className="card"><h2>Projetos críticos</h2>{crit.length ? crit.map(x => <div className="cr" key={x.p.id} onClick={() => go('projeto', x.p.id)}><b>{x.p.nome}</b>{x.r.map(m => <small key={m}>{m}</small>)}<div className="pg"><i style={{ width: x.pr + '%' }} /></div></div>) : <small>Nenhum projeto crítico agora.</small>}<small className="nt">Crítico: tarefa atrasada, prazo vencido ou prazo em até 14 dias com menos de 70% concluído.</small></div></div>
        <div className="sec"><h2>Capacitações</h2></div>
        <div className="card" style={{ marginBottom: 16 }}><div className="bar" style={{ margin: 0 }}><span><b>{com.length} de {part.length}</b> membros ativos participaram de alguma capacitação</span><b>{part.length ? Math.round(com.length / part.length * 100) : 0}%</b></div><div className="pg"><i className="ok" style={{ width: (part.length ? com.length / part.length * 100 : 0) + '%' }} /></div></div>
        <div className="two"><Table cols={ccols} rows={com} /><div className="card"><h2>Não participaram de nenhuma</h2>{sem.length ? sem.map(x => <span key={x.id} className="chip" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>{x.nome}</span>) : <small>Todos os membros ativos já participaram.</small>}</div></div>
        <div className="sec"><h2>Membros destaque</h2></div>
        <div className="two">{top ? <div className="card hl2"><span className="st"><Ic k="star" /></span><span className="av big">{ini(top.u.nome)}</span><b>{top.u.nome}</b><span>{top.n} {top.n == 1 ? 'contribuição' : 'contribuições'} · {top.np} no prazo</span></div> : <div className="card"><small>Ainda não há contribuições registradas.</small></div>}
            <div className="card"><h2>Top 3 em contribuições</h2>{rk.slice(0, 3).map((r, i) => <div className="mb" key={r.u.id}><span>{i + 1}º {r.u.nome.split(' ')[0]}</span><div className="pg" style={{ margin: 0 }}><i style={{ width: r.n / mx * 100 + '%' }} /></div><b>{r.n}</b></div>)}<small className="nt">Contribuições são tarefas concluídas. Gerentes e diretores não entram no ranking.</small></div></div></>
}

function CapCard({ D, e, big, on, open, tog }) {
    const full = e.inscritos.length >= e.vagas, past = e.data < D.c.hoje, n = e.inscritos.length;
    const dt = d(e.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/[.,]/g, '');
    const items = [['open', 'Ver detalhes', () => open(e.id)], ...(on ? [['x', 'Cancelar inscrição', () => tog(e), 1]] : !full && !past ? [['check', 'Inscrever-se', () => tog(e)]] : [])];
    return <div className={'cc' + (big ? ' big' : '') + (on ? ' me' : '') + (past ? ' past' : '')} onClick={() => open(e.id)}>
        <div className="ct"><h3>{e.titulo}</h3>{on && <span className="chip ok">Inscrito</span>}<span className={'chip tp-' + e.tipo}>{TIPO[e.tipo]}</span></div>
        <div className="cmeta"><span><Ic k="capacitacoes" />{dt}</span><span><Ic k="clock" />{e.hora}</span><span><Ic k="pin" />{e.sala}</span></div>
        <small>Instrutor: {e.instrutor}</small>
        <div className="cf2">{n > 0 && !D.priv && <span className="avs"><Av D={D} ids={e.inscritos.slice(0, 4)} />{n > 4 && <span className="av more">+{n - 4}</span>}</span>}<small>{n} de {e.vagas} vagas{full ? ' · esgotada' : ''}</small><Menu items={items} /></div>
    </div>
}
function CapLista({ D, up, me }) {
    const [sel, setSel] = useState(null), [tp, setTp] = useState(''), [mi, setMi] = useState(false);
    const tog = c => up('k', a => a.map(x => x.id == c.id ? { ...x, inscritos: x.inscritos.includes(me) ? x.inscritos.filter(i => i != me) : [...x.inscritos, me] } : x));
    const L = D.k.filter(e => (!tp || e.tipo == tp) && (!mi || e.inscritos.includes(me))).sort((a, b) => (a.data + a.hora) > (b.data + b.hora) ? 1 : -1);
    const nx = L.filter(e => e.data >= D.c.hoje), ps = L.filter(e => e.data < D.c.hoje), feat = nx.slice(0, 2), rest = nx.slice(2);
    const c = sel && D.k.find(x => x.id == sel), on = c && c.inscritos.includes(me);
    const card = (e, big) => <CapCard key={e.id} D={D} e={e} big={big} on={e.inscritos.includes(me)} open={setSel} tog={tog} />;
    const sec = (t, l, big) => l.length > 0 && <><div className="sec"><h2>{t}</h2><span className="chip">{l.length}</span></div><div className={'cgrid' + (big && l.length > 1 ? ' two' : '')}>{l.map(e => card(e, big))}</div></>;
    return <>
        <div className="bar"><div>{[['', 'Todas'], ...Object.entries(TIPO)].map(([k, l]) => <button key={k} className={'g ' + (tp == k ? 'on' : '')} onClick={() => setTp(k)}>{l}</button>)}</div><button className={'g ' + (mi ? 'on' : '')} onClick={() => setMi(!mi)}><Ic k="check" />Minhas inscrições</button></div>
        {sec('Próximas capacitações', feat, 1)}{sec('Mais adiante', rest)}{sec('Já realizadas', ps)}
        {!L.length && <div className="card">Nenhuma capacitação encontrada. Ajuste os filtros.</div>}
        {c && <div className="ov" onClick={() => setSel(null)}><div className="md" onClick={e => e.stopPropagation()}><span className={'chip tp-' + c.tipo}>{TIPO[c.tipo]}</span><h3 style={{ margin: '8px 0' }}>{c.titulo}</h3><p style={{ margin: '0 0 8px' }}>{fm(c.data)} às {c.hora}<br /><b>Sala:</b> {c.sala}<br />Instrutor: {c.instrutor}</p><div className="pg"><i style={{ width: c.inscritos.length / c.vagas * 100 + '%' }} /></div><small>{c.inscritos.length} de {c.vagas} vagas ocupadas</small>{!D.priv && <><p style={{ margin: '8px 0 4px' }}><b>Inscritos ({c.inscritos.length})</b></p><div>{c.inscritos.length ? c.inscritos.map(i => <span key={i} className="chip" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>{un(D, i)}</span>) : <small>Ninguém inscrito ainda</small>}</div></>}
            <div className="r"><button className="g" onClick={() => setSel(null)}>Fechar</button><button className={on ? 'g x' : ''} disabled={!on && c.inscritos.length >= c.vagas} onClick={() => tog(c)}>{on ? 'Cancelar inscrição' : c.inscritos.length >= c.vagas ? 'Vagas esgotadas' : 'Inscrever-se'}</button></div></div></div>}</>
}

const sz = n => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
function Gestao({ D, up, form, me }) {
    const [pid, setPid] = useState(null), [ov, setOv] = useState(false), fi = useRef(null), pa = D.g.find(x => x.id == pid), cnt = id => D.d.filter(x => x.pastaId == id).length;
    const nova = f => form(f ? 'Renomear pasta' : 'Nova pasta', [{ k: 'nome', l: 'Nome da pasta' }], f ? { nome: f.nome } : {}, o => up('g', a => f ? a.map(x => x.id == f.id ? { ...x, nome: o.nome } : x) : [...a, { id: nid(a), ...o }]));
    const delP = f => (!cnt(f.id) || confirm('Excluir esta pasta e seus ' + cnt(f.id) + ' documento(s)?')) && (up('g', a => a.filter(x => x.id != f.id)), up('d', a => a.filter(x => x.pastaId != f.id)));
    const add = list => { const fs = Array.from(list || []); if (!fs.length) return; const n = fs.map(f => ({ nome: f.name, tam: f.size, ext: f.name.includes('.') ? f.name.split('.').pop().toUpperCase().slice(0, 5) : '—', data: D.c.hoje, autor: un(D, me), url: URL.createObjectURL(f) })); up('d', a => { const b = nid(a); return [...a, ...n.map((x, i) => ({ id: b + i, pastaId: pid, ...x }))] }) };
    const ren = x => form('Renomear documento', [{ k: 'nome', l: 'Nome' }], { nome: x.nome }, o => up('d', a => a.map(y => y.id == x.id ? { ...y, nome: o.nome } : y)));
    const bx = x => { const a = document.createElement('a'); a.href = x.url; a.download = x.nome; a.click() };
    const delD = x => { URL.revokeObjectURL(x.url); up('d', a => a.filter(y => y.id != x.id)) };
    if (!pa) return <><div className="bar"><div style={{ display: 'block' }}><h1>Gestão</h1><p className="sub" style={{ margin: 0 }}>Documentos da empresa, organizados por pasta.</p></div><button onClick={() => nova()}><Ic k="plus" />Nova pasta</button></div>
        <div className="fgrid">{D.g.map(f => <div className="fc" key={f.id} onClick={() => setPid(f.id)}><span className="fi"><Ic k="gestao" /></span><div><b>{f.nome}</b><small>{cnt(f.id)} documento{cnt(f.id) == 1 ? '' : 's'}</small></div><Menu items={[['open', 'Abrir', () => setPid(f.id)], ['edit', 'Renomear', () => nova(f)], ['trash', 'Excluir', () => delP(f), 1]]} /></div>)}</div>
        {!D.g.length && <div className="card">Nenhuma pasta ainda. Use “Nova pasta”.</div>}</>;
    const L = D.d.filter(x => x.pastaId == pid);
    const cols = [{ k: 'nome', l: 'Documento', render: x => <span className="fn"><Ic k="file" />{x.nome}</span> }, { k: 'ext', l: 'Tipo', filter: 1 }, { k: 'tam', l: 'Tamanho', render: x => sz(x.tam) }, { k: 'autor', l: 'Enviado por', filter: 1 }, { k: 'data', l: 'Data', render: x => fm(x.data) }, { l: 'Ações', render: x => <Menu items={[['download', 'Baixar', () => bx(x)], ['edit', 'Renomear', () => ren(x)], ['trash', 'Excluir', () => delD(x), 1]]} /> }];
    return <div className={'dw' + (ov ? ' on' : '')} onDragOver={e => { e.preventDefault(); setOv(true) }} onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setOv(false)} onDrop={e => { e.preventDefault(); setOv(false); add(e.dataTransfer.files) }}>
        <div className="bar"><div><button className="g" onClick={() => setPid(null)}><Ic k="back" />Voltar</button><h1>{pa.nome}</h1></div><div><input ref={fi} type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} /><button onClick={() => fi.current.click()}><Ic k="upload" />Enviar documentos</button></div></div>
        {L.length ? <Table cols={cols} rows={L} /> : <div className="dz"><Ic k="upload" /><b>Nenhum documento nesta pasta</b><small>Arraste arquivos para cá ou use “Enviar documentos”.</small></div>}</div>
}

function Checkins({ D, up, me }) {
    const wk = semana(D), eu = D.u.find(u => u.id == me), gestor = eu?.perfil != 'membro', [ab, setAb] = useState('meus');
    const mine = D.i.find(x => x.usuarioId == me && x.semana == wk), [ed, setEd] = useState(!mine), [v, setV] = useState(mine || { humor: 3, resumo: '', aprendizados: '', sentimento: '' });
    const [sw, setSw] = useState(wk), [fm2, setFm2] = useState('');
    const set = (k, x) => setV(o => ({ ...o, [k]: x })), time = D.u.filter(u => u.ativo && u.perfil == 'membro');
    const send = e => { e.preventDefault(); up('i', a => mine ? a.map(x => x.id == mine.id ? { ...x, ...v } : x) : [...a, { id: nid(a), usuarioId: me, semana: wk, ...v }]); setEd(false) };
    const hist = D.i.filter(x => x.usuarioId == me && x.semana != wk).sort((a, b) => a.semana < b.semana ? 1 : -1);
    const Tx = ({ x }) => <dl className="ci"><dt>Como foi a semana</dt><dd>{x.resumo}</dd><dt>Aprendizados</dt><dd>{x.aprendizados}</dd>{x.sentimento && <><dt>Como se sentiu</dt><dd>{x.sentimento}</dd></>}</dl>;
    const weeks = [...new Set([wk, ...D.i.map(x => x.semana)])].sort().reverse(), L = D.i.filter(x => x.semana == sw && (!fm2 || x.usuarioId == fm2)).sort((a, b) => un(D, a.usuarioId) > un(D, b.usuarioId) ? 1 : -1);
    const pend = time.filter(u => (!fm2 || u.id == fm2) && !D.i.some(x => x.usuarioId == u.id && x.semana == sw)), media = L.length ? L.reduce((s, x) => s + x.humor, 0) / L.length : 0;
    return <><div className="bar"><div style={{ display: 'block' }}><h1>Check-in semanal</h1><p className="sub" style={{ margin: 0 }}>{ab == 'meus' ? 'Conte como foi a semana, o que aprendeu e como se sentiu.' : 'Acompanhe os check-ins de toda a equipe.'}</p></div></div>
        {gestor && <div className="bar"><div>{[['meus', 'Meus check-ins'], ['equipe', 'Equipe']].map(([k, l]) => <button key={k} className={'g ' + (ab == k ? 'on' : '')} onClick={() => setAb(k)}>{l}</button>)}</div></div>}
        {ab == 'meus' ? <div className="two">
            {ed || !mine ? <form className="card" onSubmit={send}><h2>Esta semana</h2><small>Semana de {fm(wk)}. Leva menos de um minuto.</small>
                <div className="mood" role="radiogroup" aria-label="Como foi sua semana">{HUM.map((l, i) => <button type="button" role="radio" aria-checked={v.humor == i + 1} key={l} className={'g s' + (v.humor == i + 1 ? ' on' : '')} onClick={() => set('humor', i + 1)}>{l}</button>)}</div>
                <label>Como foi a semana?<textarea className="ta" required rows={3} value={v.resumo} onChange={e => set('resumo', e.target.value)} /></label>
                <label>Quais foram seus aprendizados?<textarea className="ta" required rows={3} value={v.aprendizados} onChange={e => set('aprendizados', e.target.value)} /></label>
                <label>Como você se sentiu? Precisa de apoio?<textarea className="ta" rows={3} value={v.sentimento} onChange={e => set('sentimento', e.target.value)} /></label>
                <div className="r">{mine && <button type="button" className="g" onClick={() => setEd(false)}>Cancelar</button>}<button>Enviar check-in</button></div></form>
                : <div className="card"><div className="bar" style={{ margin: 0 }}><h2>Esta semana</h2><Hm n={mine.humor} /></div><small>Semana de {fm(wk)} · enviado</small><Tx x={mine} /><div className="act"><button className="g s" onClick={() => { setV(mine); setEd(true) }}><Ic k="edit" />Editar check-in</button></div></div>}
            <div className="card"><h2>Meu histórico</h2>{hist.length ? hist.map(x => <div className="fbk" key={x.id}><div className="bar" style={{ margin: 0 }}><b>Semana de {fm(x.semana)}</b><Hm n={x.humor} /></div><Tx x={x} /></div>) : <small>Seus check-ins anteriores aparecem aqui.</small>}</div></div>
            : <><div className="tb"><select aria-label="Semana" value={sw} onChange={e => setSw(e.target.value)}>{weeks.map(w => <option key={w} value={w}>Semana de {fm(w)}</option>)}</select>
                <select aria-label="Membro" value={fm2} onChange={e => setFm2(e.target.value)}><option value="">Todos os membros</option>{time.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
                <div className="stats" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}><div className="card"><b>{L.length}</b><span>Check-ins enviados</span></div><div className="card"><b>{pend.length}</b><span>Pendentes</span></div><div className="card"><b>{media ? media.toFixed(1).replace('.', ',') : '—'}</b><span>Humor médio (1 a 5)</span></div></div>
                <div className="g2">{L.map(x => <div className="card" key={x.id}><div className="bar" style={{ margin: 0 }}><span><span className="av" style={{ marginRight: 8 }}>{ini(un(D, x.usuarioId))}</span><b>{un(D, x.usuarioId)}</b></span><Hm n={x.humor} /></div><Tx x={x} /></div>)}
                    {pend.length > 0 && <div className="card"><h2>Pendentes</h2>{pend.map(u => <span key={u.id} className="chip" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>{u.nome}</span>)}</div>}</div>
                {!L.length && <div className="card"><small>Nenhum check-in nesta semana.</small></div>}</>}</>
}

function Cap(p) {
    const [ab, setAb] = useState('lista');
    return <><div className="bar"><div style={{ display: 'block' }}><h1>Capacitações</h1><p className="sub" style={{ margin: 0 }}>{ab == 'lista' ? 'Clique em um card para ver os detalhes e se inscrever.' : 'Avalie as capacitações que você participou e veja o retorno da turma.'}</p></div></div>
        <div className="bar"><div>{[['lista', 'Capacitações'], ['feedbacks', 'Feedbacks']].map(([k, l]) => <button key={k} className={'g ' + (ab == k ? 'on' : '')} onClick={() => setAb(k)}>{k == 'feedbacks' && <Ic k="msg" />}{l}{k == 'feedbacks' && <span className="chip">{p.D.f.length}</span>}</button>)}</div></div>
        {ab == 'lista' ? <CapLista {...p} /> : <Feedbacks {...p} />}</>
}
function Feedbacks({ D, up, me }) {
    const el = D.k.filter(e => e.data <= D.c.hoje && e.inscritos.includes(me)).sort((a, b) => a.data < b.data ? 1 : -1);
    const ld = id => { const x = D.f.find(f => f.capId == id && f.usuarioId == me); return x ? { nota: x.nota, bom: x.bom, melhorar: x.melhorar } : { nota: 0, bom: '', melhorar: '' } };
    const [cid, setCid] = useState(el[0]?.id ?? ''), [v, setV] = useState(() => ld(el[0]?.id)), [ok, setOk] = useState(false);
    const pick = id => { setCid(+id); setV(ld(+id)); setOk(false) }, set = (k, x) => setV(o => ({ ...o, [k]: x })), ex = D.f.find(f => f.capId == cid && f.usuarioId == me);
    const send = e => { e.preventDefault(); if (!v.nota) return; up('f', a => [...a.filter(x => !(x.capId == cid && x.usuarioId == me)), { id: nid(a), capId: cid, usuarioId: me, data: D.c.hoje, ...v }]); setOk(true) };
    const caps = D.k.filter(k => D.f.some(f => f.capId == k.id)).sort((a, b) => a.data < b.data ? 1 : -1);
    return <div className="two">
        <div>{caps.length ? caps.map(k => {
            const L = D.f.filter(f => f.capId == k.id), m = L.reduce((s, f) => s + f.nota, 0) / L.length; return <div className="card" key={k.id} style={{ marginBottom: 16 }}>
                <div className="bar" style={{ margin: 0 }}><div style={{ display: 'block' }}><h2 style={{ margin: 0 }}>{k.titulo}</h2><small>{fm(k.data)} · Instrutor: {k.instrutor}</small></div><div><Stars n={Math.round(m)} /><b>{m.toFixed(1).replace('.', ',')}</b><small>({L.length})</small></div></div>
                {L.map(f => <div className="fbk" key={f.id}><div className="bar" style={{ margin: 0 }}><b>{un(D, f.usuarioId)}</b><Stars n={f.nota} /></div>{f.bom && <p><small>O que funcionou</small><br />{f.bom}</p>}{f.melhorar && <p><small>O que melhorar</small><br />{f.melhorar}</p>}</div>)}</div>
        }) : <div className="card"><small>Nenhum feedback enviado ainda.</small></div>}</div>
        <div className="card" style={{ alignSelf: 'start' }}><h2>Dar feedback</h2>{el.length ? <form onSubmit={send}>
            <label>Capacitação<select value={cid} onChange={e => pick(e.target.value)}>{el.map(e => <option key={e.id} value={e.id}>{e.titulo} ({fm(e.data)})</option>)}</select></label>
            <div className="fl">Nota<Stars n={v.nota} set={n => set('nota', n)} /></div>
            <label style={{ marginTop: 12 }}>O que funcionou bem?<textarea className="ta" rows={3} value={v.bom} onChange={e => set('bom', e.target.value)} /></label>
            <label>O que pode melhorar?<textarea className="ta" rows={3} value={v.melhorar} onChange={e => set('melhorar', e.target.value)} /></label>
            <div className="r"><button disabled={!v.nota}>{ex ? 'Atualizar feedback' : 'Enviar feedback'}</button></div>{ok && <small role="status">Feedback salvo. Obrigado!</small>}</form>
            : <small>Você poderá dar feedback depois de participar de uma capacitação já realizada.</small>}</div></div>
}

function Preco({ D }) {
    const S = D.c.senioridades, ms = D.u.filter(u => u.ativo && u.perfil == 'membro'), [sel, setSel] = useState(ms.slice(0, 3).map(u => u.id)), [hs, setHs] = useState({}), [vh, setVh] = useState(D.c.valorHora), [mg, setMg] = useState(30), [imp, setImp] = useState(10);
    const hr = id => hs[id] ?? 40, rate = u => +vh[u.senioridade || 'junior'] || 0, k = (1 + mg / 100) / (1 - Math.min(imp, 99) / 100);
    const L = sel.map(id => D.u.find(u => u.id == id)).filter(Boolean), horas = L.reduce((s, u) => s + hr(u.id), 0), custo = L.reduce((s, u) => s + hr(u.id) * rate(u), 0), base = custo * (1 + mg / 100), preco = custo * k;
    const num = (f, max) => e => f(Math.min(max ?? 1e9, Math.max(0, +e.target.value)));
    return <><div className="bar"><div style={{ display: 'block' }}><h1>Simular precificação</h1><p className="sub" style={{ margin: 0 }}>Escolha a equipe, defina as horas e veja o valor hora de cada membro por senioridade.</p></div></div>
        <div className="two"><div className="card"><div className="fl">Membros da proposta<Multi opts={ms} value={sel} onChange={setSel} /></div>
            {L.length ? <div className="tw" style={{ marginTop: 14 }}><table><thead><tr><th className="n">Membro</th><th className="n">Senioridade</th><th className="n">Valor hora (custo)</th><th className="n">Valor hora (venda)</th><th className="n">Horas</th><th className="n">Subtotal (venda)</th></tr></thead>
                <tbody>{L.map(u => <tr key={u.id}><td>{u.nome}</td><td><span className="chip">{S[u.senioridade || 'junior']}</span></td><td>{brl(rate(u))}</td><td>{brl(rate(u) * k)}</td><td><input type="number" min="0" aria-label={'Horas de ' + u.nome} value={hr(u.id)} onChange={num(n => setHs(o => ({ ...o, [u.id]: n })))} /></td><td><b>{brl(hr(u.id) * rate(u) * k)}</b></td></tr>)}</tbody>
                <tfoot><tr><td colSpan="4"><b>Total</b></td><td><b>{horas} h</b></td><td><b>{brl(preco)}</b></td></tr></tfoot></table></div> : <p><small>Selecione ao menos um membro para simular.</small></p>}</div>
            <div className="stk"><div className="card"><h2>Parâmetros</h2>
                {Object.entries(S).map(([key, l]) => <label key={key}>Valor hora {l} (R$)<input type="number" min="0" value={vh[key]} onChange={num(n => setVh(o => ({ ...o, [key]: n })))} /></label>)}
                <label>Margem (%)<input type="number" min="0" value={mg} onChange={num(setMg)} /></label><label style={{ margin: 0 }}>Impostos (%)<input type="number" min="0" max="99" value={imp} onChange={num(setImp, 99)} /></label></div>
                <div className="card"><h2>Resultado</h2>
                    <div className="pl"><span>Horas totais</span><b>{horas} h</b></div><div className="pl"><span>Custo da equipe</span><b>{brl(custo)}</b></div><div className="pl"><span>Margem ({mg}%)</span><b>{brl(base - custo)}</b></div><div className="pl"><span>Impostos ({imp}%)</span><b>{brl(preco - base)}</b></div>
                    <div className="pv"><small>Preço final da proposta</small><b>{brl(preco)}</b></div><small>Valor hora médio de venda: {brl(horas ? preco / horas : 0)}</small></div></div></div></>
}

function Login({ D, entrar }) {
    const [em, setEm] = useState(''), [sn, setSn] = useState(''), [er, setEr] = useState('');
    const ok = D.u.filter(u => u.ativo);
    const send = e => { e.preventDefault(); const u = D.u.find(x => x.email.toLowerCase() == em.trim().toLowerCase()); if (!u || !u.ativo) return setEr('E-mail não encontrado ou usuário inativo.'); if (sn != D.c.senhaDemo) return setEr('Senha incorreta.'); entrar(u.id) };
    return <div className="lg"><aside className="lgb"><img src="assets/logo-branca.png" alt="Konvex Jr" /><h1>Bem-vindo de volta.</h1><p>Seus projetos, capacitações e o check-in da semana estão te esperando.</p></aside>
        <div className="lgf"><form onSubmit={send}><h2 style={{ fontSize: 26, margin: '0 0 4px' }}>Entrar</h2><small>Use seu e-mail corporativo.</small>
            <label style={{ marginTop: 18 }}>E-mail<input type="email" required autoComplete="username" value={em} onChange={e => { setEm(e.target.value); setEr('') }} placeholder="voce@empresa.com" /></label>
            <label>Senha<input type="password" required autoComplete="current-password" value={sn} onChange={e => { setSn(e.target.value); setEr('') }} /></label>
            {er && <p className="lge" role="alert">{er}</p>}<button style={{ width: '100%', padding: 12 }}>Entrar</button>
            <div className="lgd"><small>Demonstração · senha de todos: <b>{D.c.senhaDemo}</b>. Acesso rápido:</small><div>{ok.map(u => <button type="button" className="g s" key={u.id} onClick={() => entrar(u.id)}>{u.nome.split(' ')[0]} <small>{u.perfil}</small></button>)}</div></div></form></div></div>
}
function Root({ init }) {
    const [D, setD] = useState(init), [me, setMe] = useState(() => { try { const s = +sessionStorage.getItem('sessao'); return init.u.find(u => u.id == s && u.ativo) ? s : null } catch (e) { return null } });
    const entrar = id => { try { sessionStorage.setItem('sessao', id) } catch (e) { } setMe(id); scrollTo(0, 0) }, sair = () => { try { sessionStorage.removeItem('sessao') } catch (e) { } setMe(null); scrollTo(0, 0) };
    if (me) return <App D={D} setD={setD} me={me} sair={sair} />;
    return <Login D={D} entrar={entrar} />
}

function Loader() {
    const [init, setInit] = useState(null), [err, setErr] = useState(false);
    useEffect(() => { Promise.all(['config', 'usuarios', 'projetos', 'tarefas', 'capacitacoes', 'gestao', 'checkins', 'feedbacks'].map(n => fetch('dados/' + n + '.json').then(r => r.json()))).then(([c, u, p, t, k, g, i, f]) => setInit({ c, u, p, t, k, g, i, f, d: [] })).catch(() => setErr(true)) }, []);
    if (err) return <main><div className="card">Não foi possível ler os arquivos da pasta <b>dados/</b>. Abra o sistema por um servidor local (ex.: <code>python -m http.server</code> dentro da pasta <b>sistema/</b>) e acesse http://localhost:8000.</div></main>;
    return init ? <Root init={init} /> : <main>Carregando…</main>
}
ReactDOM.createRoot(document.getElementById('root')).render(<Loader />);