import map from '../data/lucide-fa-map.json';
import fa from '../../../tests/fixtures/elementor/fa-free-icons.json';

describe( 'Lucide → Font Awesome map', () => {
	it( 'only references icons that ship with Elementor Free', () => {
		const lists = fa as Record< string, string[] >;
		const missing = Object.entries( map as Record< string, string > ).filter( ( [ , v ] ) => {
			const [ prefix, name ] = v.split( ' ' ) as [ string, string ];
			return ! lists[ prefix ]?.includes( name.replace( /^fa-/, '' ) );
		} );
		expect( missing ).toEqual( [] );
	} );
} );
