import { read, utils as xlsxUtil } from 'xlsx';

export async function fetchQuery(query, value) {
  const queryRes = await fetch(
    `${process.env.NEXT_PUBLIC_CKAN_URL}/package_search?fq=${query}:"${value}" AND organization:constituency-wise-scheme-data AND  private:false&rows=50`
  ).then((res) => res.json());

  return queryRes.result.results;
}

export async function fetchSheets(link, aoa = true) {
  const result = [];
  await fetch(link)
    .then((res) => {
      if (!res.ok) throw new Error('fetch failed');
      return res.arrayBuffer();
    })
    .then((ab) => {
      const file = new Uint8Array(ab);
      const workbook = read(file, { type: 'array' });

      workbook.SheetNames.forEach((bookName) => {
        const data = workbook.Sheets[bookName];

        const dataParse = xlsxUtil.sheet_to_json(data, {
          header: aoa ? 1 : undefined,
          blankrows: false,
        });

        result.push(dataParse);
      });
    });
  return result;
}

export async function stateSchemeFetch() {
  const stateList = await fetchQuery(
    'schemeType',
    'Centrally Sponsored Scheme'
  );

  const statesData = stateList.map((scheme) => ({
    state: scheme.extras[3].value,
    scheme_name: scheme.extras[0].value,
    slug: scheme.extras[2].value,
  }));

  const stateScheme = {};
  statesData.map((state) => {
    state.state.split(',').map((each_state) => {
      if (each_state in stateScheme) {
        stateScheme[each_state].push({
          scheme_name: state.scheme_name,
          scheme_slug: state.slug,
        });
      } else {
        stateScheme[each_state] = [
          { scheme_name: state.scheme_name, scheme_slug: state.slug },
        ];
      }
      return null;
    });
    return null;
  });

  return stateScheme;
}

export async function stateDataFetch(id) {
  const data = await fetch(
    `${process.env.NEXT_PUBLIC_CKAN_URL}/package_search?fq=organization:constituency-wise-scheme-data%20AND%20schemeType:"${id}"`
  ).then((res) => res.json());

  const sheet = await fetchSheets(
    data.result.results[0].resources[0].url,
    false
  );

  return sheet;
}

export async function consListFetch(id = 'Cons Info') {
  const data = await fetch(
    `${process.env.NEXT_PUBLIC_CKAN_URL}/package_search?fq=organization:constituency-wise-scheme-data%20AND%20schemeType:"${id}"`
  ).then((res) => res.json());

  const sheet = await fetchSheets(
    data.result.results[0].resources[0].url,
    false
  );

  const consListObj = {
    lok: {},
    vidhan: {},
  };

  sheet[0].forEach((obj) => {
    // check if there is a state object inside sabha
    if (consListObj[obj.constituency_type][obj.state_ut_name]) {
      consListObj[obj.constituency_type][obj.state_ut_name].push(obj);
    } else {
      consListObj[obj.constituency_type][obj.state_ut_name] = [obj];
    }
  });

  return consListObj;
}

export function generateSlug(slug) {
  if (slug) {
    const temp = slug.toLowerCase().replace(/\W/g, '-'); // lower case and replace space & special chars witn '-'
    return temp.replace(/-+/g, '-').replace(/-$/, ''); // remove multiple '-' and remove '-' from end of string
  }
  return null;
}

export async function dataTransform(id) {
  const obj: any = {
    ac: {},
    pc: {},
  };
  if (id) {
    let name;
    let type;
    let slug;
    let acUrl;
    let pcUrl;
    await fetchQuery('slug', id).then((data) => {
      data[0].resources.forEach((file) => {
        if (file.name.includes('pc.xlsx')) pcUrl = file.url;
        else if (file.name.includes('ac.xlsx')) acUrl = file.url;
      });

      name = data[0].extras[0].value;
      type = data[0].extras[1].value;
      slug = data[0].name || '';
    });

    if (acUrl) {
      await fetchSheets(acUrl).then((res) => {
        const dataParse = res[0];
        const metaParse = res[1];
        let metaObj: any = {};

        // Meta Data
        metaParse.forEach((val) => {
          if (val[0]) {
            metaObj = {
              ...metaObj,
              [generateSlug(val[0])]: val[1],
            };
          }
        });

        // creating list of constituencies
        const consList = {};
        dataParse.map((item, index) => {
          if (consList[item[0]]) {
            if (item[3] == dataParse[index - 1][3]) return;
            consList[item[0]].push({
              constName: item[2],
              constCode: item[3],
            });
          } else {
            if (item[0] == 'state_ut_name') return;
            else
              consList[item[0]] = [
                {
                  constName: item[2],
                  constCode: item[3],
                },
              ];
          }
        });

        obj.ac.metadata = {
          description: metaObj['scheme-description'] || '',
          name: name || '',
          frequency: metaObj.frequency || '',
          source: metaObj['data-source'] || '',
          type: type || '',
          note: metaObj['note:'] || '',
          slug,
          indicators: [],
          consList: consList || [],
        };

        // Tabular Data
        for (let i = 5; i < dataParse[0].length; i += 1) {
          let fiscal_year = {};
          const state_Obj = {};
          for (let j = 1; j < dataParse.length; j += 1) {
            if (!(dataParse[j][0] in state_Obj)) {
              fiscal_year = {};
            }
            if (dataParse[j][4]) {
              fiscal_year[dataParse[j][4].trim()] = {
                ...fiscal_year[dataParse[j][4].trim()],
                [dataParse[j][3]]: Number.isNaN(parseFloat(dataParse[j][i]))
                  ? '0'
                  : parseFloat(dataParse[j][i]).toFixed(2),
              };
            }
            state_Obj[dataParse[j][0]] = { ...fiscal_year };
          }
          const indicatorSlug =
            generateSlug(metaObj[`indicator-${i - 4}-name`]) || '';

          obj.ac.metadata.indicators.push(indicatorSlug);

          obj.ac.data = {
            ...obj.ac.data,
            [`indicator_0${i - 4}`]: {
              state_Obj,
              name: metaObj[`indicator-${i - 4}-name`] || '',
              description: metaObj[`indicator-${i - 4}-description`] || '',
              note: metaObj[`indicator-${i - 4}-note`] || '',
              slug: indicatorSlug,
              unit: metaObj[`indicator-${i - 4}-unit`] || '',
            },
          };
        }
      });
    }

    if (pcUrl) {
      await fetchSheets(pcUrl).then((res) => {
        const dataParse = res[0];
        const metaParse = res[1];
        let metaObj: any = {};

        // Meta Data
        metaParse.forEach((val) => {
          if (val[0]) {
            metaObj = {
              ...metaObj,
              [generateSlug(val[0])]: val[1],
            };
          }
        });

        // creating list of constituencies
        const consList = {};
        dataParse.map((item, index) => {
          if (consList[item[0]]) {
            if (item[3] == dataParse[index - 1][3]) return;
            consList[item[0]].push({
              constName: item[2],
              constCode: item[3],
            });
          } else {
            if (item[0] == 'state_ut_name') return;
            else
              consList[item[0]] = [
                {
                  constName: item[2],
                  constCode: item[3],
                },
              ];
          }
        });

        obj.pc.metadata = {
          description: metaObj['scheme-description'] || '',
          name: name || '',
          frequency: metaObj.frequency || '',
          source: metaObj['data-source'] || '',
          type: type || '',
          note: metaObj['note:'] || '',
          slug,
          indicators: [],
          consList: consList || [],
        };

        // Tabular Data
        for (let i = 5; i < dataParse[0].length; i += 1) {
          let fiscal_year = {};
          const state_Obj = {};
          for (let j = 1; j < dataParse.length; j += 1) {
            if (!(dataParse[j][0] in state_Obj)) {
              fiscal_year = {};
            }
            if (dataParse[j][4]) {
              fiscal_year[dataParse[j][4].trim()] = {
                ...fiscal_year[dataParse[j][4].trim()],
                [dataParse[j][3]]: Number.isNaN(parseFloat(dataParse[j][i]))
                  ? '0'
                  : parseFloat(dataParse[j][i]).toFixed(2),
              };
            }
            state_Obj[dataParse[j][0]] = { ...fiscal_year };
          }

          const indicatorSlug =
            generateSlug(metaObj[`indicator-${i - 4}-name`]) || '';

          obj.pc.metadata.indicators.push(indicatorSlug);

          obj.pc.data = {
            ...obj.pc.data,
            [`indicator_0${i - 4}`]: {
              state_Obj,
              name: metaObj[`indicator-${i - 4}-name`] || '',
              description: metaObj[`indicator-${i - 4}-description`] || '',
              note: metaObj[`indicator-${i - 4}-note`] || '',
              slug: indicatorSlug,
              unit: metaObj[`indicator-${i - 4}-unit`] || '',
            },
          };
        }
      });
    }
  }
  return obj;
}

export async function consDescFetch() {
  const constDesc = await stateDataFetch('const_desc');
  const ac = constDesc[0];
  const pc = constDesc[1];
  const finalObj = {
    vidhan: {},
    lok: {},
  };

  // refactor into a function
  ac.forEach((item) => {
    if (!finalObj.vidhan[item.state_name]) {
      finalObj.vidhan[item.state_name] = {
        [item.constituency_code]: item['Final Description'],
      };
    } else {
      finalObj.vidhan[item.state_name][item.constituency_code] =
        item['Final Description'];
    }
  });
  pc.forEach((item) => {
    if (!finalObj.lok[item.state_name]) {
      finalObj.lok[item.state_name] = {
        [item.constituency_code]: item['Final Description'],
      };
    } else {
      finalObj.lok[item.state_name][item.constituency_code] =
        item['Final Description'];
    }
  });
  return finalObj;
}
