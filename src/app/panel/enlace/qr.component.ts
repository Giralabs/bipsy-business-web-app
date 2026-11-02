import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import qrcode from 'qrcode-generator';

export interface QrMatrix {
  size: number;
  isDark(row: number, col: number): boolean;
}

/**
 * The modules of a link. Medium error correction (15%), as `qr_code.dart`: the
 * low one gives fatter modules, but this ends up printed in a shop window, and a
 * scuffed poster or a peeling corner still has to read.
 */
export function qrMatrix(data: string): QrMatrix {
  const code = qrcode(0, 'M');
  code.addData(data, 'Byte');
  code.make();
  return { size: code.getModuleCount(), isDark: (row, col) => code.isDark(row, col) };
}

/** The four modules of white a reader needs around the code. */
const QUIET_ZONE = 4;

/**
 * A QR code as a vector. Dark on white ALWAYS, also with the panel in dark: many
 * readers cannot read a negative.
 */
@Component({
  selector: 'pn-qr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="viewBox" role="img" [attr.aria-label]="label" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#FFFFFF" />
      <path [attr.d]="path" fill="#1C1F23" />
    </svg>
  `,
  styles: [`:host { display: block; } svg { display: block; width: 100%; height: auto; }`],
})
export class PnQrComponent implements OnChanges {
  @Input({ required: true }) data = '';
  @Input() label = 'Código QR';

  viewBox = '0 0 1 1';
  path = '';

  ngOnChanges(): void {
    const matrix = qrMatrix(this.data);
    this.viewBox = `0 0 ${matrix.size + QUIET_ZONE * 2} ${matrix.size + QUIET_ZONE * 2}`;
    let path = '';
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (matrix.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    this.path = path;
  }
}
