import {ComponentFixture, TestBed} from '@angular/core/testing';

import { NlEventComponent } from './event.component';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';

describe('NlEventComponent', () => {
  let component: NlEventComponent;
  let httpTestingController: HttpTestingController;
  let fixture: ComponentFixture<NlEventComponent>;

  const events = [
    {eventId: 1, name: 'Test1', begin: 'Test1', end: 'Test1', place: 'Test1', image: 'Test1', description: 'Test1'},
    {eventId: 2, name: 'Test2', begin: 'Test2', end: 'Test2', place: 'Test2', image: 'Test2', description: 'Test2'},
    {eventId: 5, name: 'efzrg', begin: '18/05/2020', end: '18/05/2020', place: 'Test3', image: 'Test3', description: 'Test3'}
  ];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ NlEventComponent ],
      imports: [HttpClientTestingModule]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    component = TestBed.inject(NlEventComponent);
    fixture = TestBed.createComponent(NlEventComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('When page loads, should render the events from the DB', () => {
    component.sendValues(events);
    expect(component.transition).toBe(events);
  });

  it('should make get request', () => {
    component.ngOnInit();
    const req = httpTestingController.expectOne('https://valoukervyn.ephec-ti.be:8888/api/evenement');
    expect(req.request.method).toEqual('GET');
  });

  it('should make get request on tri()', () => {
    component.tri('name', 'Nom');
    const req = httpTestingController.expectOne('https://valoukervyn.ephec-ti.be:8888/api/evenement/name');
    expect(req.request.method).toEqual('GET');
  });

  it('should make get request on triAnnee()',  () => {
    component.triAnnee('2020', 'Année');
    const req = httpTestingController.expectOne('https://valoukervyn.ephec-ti.be:8888/api/evenement/annee/2020');
    expect(req.request.method).toEqual('GET');
  });
});
