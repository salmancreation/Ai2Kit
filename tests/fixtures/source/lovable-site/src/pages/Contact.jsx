export default function Contact() {
	return (
		<main>
			<section className="section">
				<div className="container narrow">
					<h1 className="center">Let's talk</h1>
					<p className="lead center">Tell us about your project. We reply within one business day.</p>
					<form className="form card" onSubmit={ ( e ) => e.preventDefault() }>
						<label className="field">Name<input name="name" required /></label>
						<label className="field">Email<input name="email" type="email" required /></label>
						<label className="field">Message<textarea name="message" rows="4" /></label>
						<button type="submit" className="btn btn-primary">Send message</button>
					</form>
				</div>
			</section>
		</main>
	);
}
