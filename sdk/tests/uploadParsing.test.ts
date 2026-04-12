import { parseUploadResponse, parseStatusResponse } from '../src/utils/xmlParser';

describe('ANAF Upload Response Parsing', () => {
  test('should parse successful upload response', () => {
    const successXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:spv:respUploadFisier:v1" 
        dateResponse="202108051140" 
        ExecutionStatus="0" 
        index_incarcare="3828"/>`;

    const result = parseUploadResponse(successXml);

    expect(result).toEqual({
      indexIncarcare: '3828',
      dateResponse: '202108051140',
      executionStatus: 0,
    });
  });

  test('should parse failed upload response', () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:spv:respUploadFisier:v1" 
        dateResponse="202108051144" 
        ExecutionStatus="1">
    <Errors errorMessage="Fisierul transmis nu este valid."/>
</header>`;

    const result = parseUploadResponse(errorXml);

    expect(result).toEqual({
      executionStatus: 1,
      dateResponse: '202108051144',
      errors: ['Fisierul transmis nu este valid.'],
    });
  });

  test('should parse status response with ok state', () => {
    const statusXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:efactura:stareMesajFactura:v1" 
        stare="ok" 
        id_descarcare="1234"/>`;

    const result = parseStatusResponse(statusXml);

    expect(result).toEqual({
      stare: 'ok',
      idDescarcare: '1234',
    });
  });

  test('should parse status response with in progress state', () => {
    const statusXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:efactura:stareMesajFactura:v1" 
        stare="in prelucrare"/>`;

    const result = parseStatusResponse(statusXml);

    expect(result).toEqual({
      stare: 'in prelucrare',
    });
  });

  test('should parse status error response', () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:efactura:stareMesajFactura:v1">
    <Errors errorMessage="Nu aveti dreptul sa consultati starea acestui upload."/>
</header>`;

    const result = parseStatusResponse(errorXml);

    expect(result).toEqual({
      errors: ['Nu aveti dreptul sa consultati starea acestui upload.'],
    });
  });

  test('should handle file size error', () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:spv:respUploadFisier:v1" 
        dateResponse="202108051144" 
        ExecutionStatus="1">
    <Errors errorMessage="Marime fisier transmis mai mare de 10 MB."/>
</header>`;

    const result = parseUploadResponse(errorXml);

    expect(result).toEqual({
      dateResponse: '202108051144',
      executionStatus: 1,
      indexIncarcare: undefined,
      errors: ['Marime fisier transmis mai mare de 10 MB.'],
    });
  });

  test('should handle CIF validation error', () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<header xmlns="mfp:anaf:dgti:spv:respUploadFisier:v1" 
        dateResponse="202210121019" 
        ExecutionStatus="1">
    <Errors errorMessage="CIF introdus= 123a nu este un numar"/>
</header>`;

    const result = parseUploadResponse(errorXml);

    expect(result).toEqual({
      dateResponse: '202210121019',
      executionStatus: 1,
      indexIncarcare: undefined,
      errors: ['CIF introdus= 123a nu este un numar'],
    });
  });
});
