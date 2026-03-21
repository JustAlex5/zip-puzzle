import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridCanvasComponent } from './grid-canvas.component';

describe('GridCanvasComponent', () => {
  let component: GridCanvasComponent;
  let fixture: ComponentFixture<GridCanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridCanvasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GridCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
