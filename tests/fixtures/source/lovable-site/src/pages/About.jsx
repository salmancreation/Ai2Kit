const team = [ [ 'Lena Park', 'Design lead' ], [ 'Omar Haddad', 'Engineering' ], [ 'Sofia Rossi', 'Growth' ] ];

export default function About() {
	return (
		<main>
			<section className="section">
				<div className="container narrow center">
					<h1>A small studio with a big focus</h1>
					<p className="lead">Since 2014 we have helped 120+ businesses turn their website into their best salesperson.</p>
				</div>
			</section>
			<section className="section bg-muted">
				<div className="container">
					<h2 className="center">Meet the team</h2>
					<div className="grid-3">
						{ team.map( ( [ name, role ] ) => (
							<div key={ name } className="card center">
								<div className="avatar">{ name[ 0 ] }</div>
								<h3>{ name }</h3>
								<p className="muted">{ role }</p>
							</div>
						) ) }
					</div>
				</div>
			</section>
		</main>
	);
}
